import { randomUUID } from "node:crypto";
import { Booking } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { expireDueBookings } from "@/modules/bookings/application/expire-bookings";
import { startCheckout } from "@/modules/payments/application/checkout";
import { settlePayment } from "@/modules/payments/application/settle";
import { prisma } from "@/platform/db/prisma";
import { aGround, at, book, HOUR, signedIn } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// The expiry sweep (PR 4.2): unapproved and unpaid bookings past expiresAt give their slots back.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const inHours = (hours: number) => ({ now: () => new Date(Date.now() + hours * HOUR) });

const booked = async (token: string, body: object) => {
  const res = await book(token, body);
  expect(res.status).toBe(201);
  return Booking.parse(await res.json());
};

describe("expiring bookings", () => {
  it("expires unpaid bookings after the window, frees their slots, and leaves the rest", async () => {
    const { ground, hours } = await aGround({ settings: { paymentMode: "PLATFORM" } });
    const { token } = await signedIn();
    const unpaid = await booked(token, { groundId: ground.id, ...at(hours, 0, 2) });
    expect(unpaid.status).toBe("HELD");

    // Within the 15-minute window nothing happens.
    expect(await expireDueBookings()).toBe(0);

    const later = inHours(1);
    expect(await expireDueBookings(later)).toBe(1);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: unpaid.id },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    expect(stored.status).toBe("EXPIRED");
    expect(stored.events.map((event) => [event.type, event.data])).toEqual([
      ["CREATED", { status: "HELD" }],
      ["EXPIRED", { from: "HELD" }],
    ]);
    const slots = await prisma.groundSlot.findMany({
      where: { groundId: ground.id, startsAt: { in: hours.slice(0, 2) } },
    });
    expect(slots.every((slot) => slot.status === "AVAILABLE" && slot.bookingId === null)).toBe(
      true,
    );
    expect(slots.every((slot) => slot.freedAt !== null)).toBe(true);

    // Run again: nothing left to do.
    expect(await expireDueBookings(later)).toBe(0);
    // The freed time can be booked again.
    const { token: other } = await signedIn("+201009876543");
    expect((await book(other, { groundId: ground.id, ...at(hours, 0, 2) })).status).toBe(201);
  });

  it("expires bookings the venue didn't approve in time", async () => {
    const { ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const { token } = await signedIn();
    const pending = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });

    expect(await expireDueBookings(inHours(11))).toBe(0);
    expect(await expireDueBookings(inHours(13))).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe(
      "EXPIRED",
    );
  });

  it("never touches confirmed bookings", async () => {
    const { ground, hours } = await aGround({
      settings: { paymentMode: "DEPOSIT", depositPercent: 50 },
    });
    const { customer, token } = await signedIn();
    const held = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    const { checkout } = await startCheckout(
      customer.id,
      held.id,
      { method: "CARD" },
      randomUUID(),
    );
    await settlePayment(checkout.payment.id, "SUCCEEDED");

    expect(await expireDueBookings(inHours(2))).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: held.id } })).status).toBe(
      "CONFIRMED",
    );
  });

  it("works through more than one batch", async () => {
    const { ground, venue } = await aGround({ settings: { paymentMode: "PLATFORM" } });
    const customer = await prisma.venueCustomer.create({
      data: { venueId: venue.id, name: "Ahmed" },
    });
    // 250 unpaid bookings a week out, each holding its own hour. Written directly: this is about
    // the sweep's batches, not about booking.
    const first = Math.ceil(Date.now() / HOUR) * HOUR + 7 * 24 * HOUR;
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const ids = Array.from({ length: 250 }, () => randomUUID());
    await prisma.booking.createMany({
      data: ids.map((id, i) => ({
        id,
        venueId: venue.id,
        groundId: ground.id,
        customerId: customer.id,
        code: `BATCH${String(i).padStart(3, "0")}`,
        status: "HELD" as const,
        startsAt: new Date(first + i * HOUR),
        endsAt: new Date(first + (i + 1) * HOUR),
        expiresAt,
        total: 40_000,
        paymentMode: "PLATFORM" as const,
        commissionRate: 0,
        cancellationPolicy: "MODERATE" as const,
        cancellationTiers: [],
      })),
    });
    await prisma.groundSlot.createMany({
      data: ids.map((bookingId, i) => ({
        groundId: ground.id,
        venueId: venue.id,
        startsAt: new Date(first + i * HOUR),
        endsAt: new Date(first + (i + 1) * HOUR),
        tier: "BASE" as const,
        price: 40_000,
        scheduleVersion: 1,
        status: "HELD" as const,
        bookingId,
      })),
    });

    expect(await expireDueBookings(inHours(1))).toBe(250);
    expect(await prisma.booking.count({ where: { status: "EXPIRED" } })).toBe(250);
    expect(await prisma.groundSlot.count({ where: { status: "HELD" } })).toBe(0);
  });
});
