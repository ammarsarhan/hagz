import { randomUUID } from "node:crypto";
import { StaffBookingDetail, StaffBookingPage } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Walk-in and phone bookings entered by staff (PR 4.3): confirmed at once, paid at the venue, no
// commission, at the slots' prices or the venue's own total.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const enter = async (staffId: string, venueId: string, body: object, key = randomUUID()) =>
  router.request(`/v1/staff/venues/${venueId}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
      "Idempotency-Key": key,
      Authorization: `Bearer ${await signJwt({ sub: staffId, sid: randomUUID() }, { audience: "staff", ttlSeconds: 600 })}`,
    },
    body: JSON.stringify(body),
  });

const walkIn = { name: "Karim", phone: "+201005551234" };

describe("staff bookings", () => {
  it("books a walk-in, confirmed and booked at once, with no commission", async () => {
    const { venue, ground, hours } = await aGround({
      settings: { autoConfirm: false, paymentMode: "PLATFORM" },
    });
    const owner = await staffAt(venue.id);
    const res = await enter(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 0, 2),
      customer: walkIn,
      note: "Pays cash",
    });
    expect(res.status).toBe(201);
    const booking = StaffBookingDetail.parse(await res.json());
    expect(booking).toMatchObject({
      status: "CONFIRMED",
      source: "STAFF",
      hold: false,
      paymentMode: "MANUAL",
      total: 80_000,
      note: "Pays cash",
      customer: { name: "Karim", phone: "+201005551234", accountId: null },
    });
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { slots: true },
    });
    expect(stored.commissionRate).toBe(0);
    expect(stored.slots.map((slot) => slot.status)).toEqual(["BOOKED", "BOOKED"]);
  });

  it("takes the venue's own total, lower or higher, as one adjustment line", async () => {
    const { venue, ground, hours } = await aGround({ venue: { taxNumber: "123456789" } });
    const owner = await staffAt(venue.id);
    const lower = StaffBookingDetail.parse(
      await (
        await enter(owner.id, venue.id, {
          groundId: ground.id,
          ...at(hours, 0, 2),
          customer: walkIn,
          total: 70_000,
        })
      ).json(),
    );
    expect(lower.total).toBe(70_000);
    expect(lower.charges.map((charge) => [charge.type, charge.amount])).toEqual([
      ["SLOT", 40_000],
      ["SLOT", 40_000],
      ["ADJUSTMENT", -10_000],
    ]);
    expect(lower.tax).toBe(lower.charges.reduce((sum, charge) => sum + charge.taxAmount, 0));

    const higher = StaffBookingDetail.parse(
      await (
        await enter(owner.id, venue.id, {
          groundId: ground.id,
          ...at(hours, 2, 3),
          customer: walkIn,
          total: 65_000,
        })
      ).json(),
    );
    expect(higher.charges.at(-1)).toMatchObject({ type: "ADJUSTMENT", amount: 5_000 });

    const same = StaffBookingDetail.parse(
      await (
        await enter(owner.id, venue.id, {
          groundId: ground.id,
          ...at(hours, 3, 4),
          customer: walkIn,
          total: 60_000,
        })
      ).json(),
    );
    expect(same.charges.map((charge) => charge.type)).toEqual(["SLOT"]);
  });

  it("answers a retry with the same booking, and refuses taken time", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const key = randomUUID();
    const body = { groundId: ground.id, ...at(hours, 0, 1), customer: walkIn };
    const first = await enter(owner.id, venue.id, body, key);
    const retry = await enter(owner.id, venue.id, body, key);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotent-Replayed")).toBe("true");
    expect(StaffBookingDetail.parse(await retry.json()).id).toBe(
      StaffBookingDetail.parse(await first.json()).id,
    );

    const { token } = await signedIn();
    const taken = await book(token, { groundId: ground.id, ...at(hours, 0, 1) });
    expect(taken.status).toBe(409);
    const clash = await enter(owner.id, venue.id, body);
    expect(clash.status).toBe(409);
  });

  it("refuses an adjustment of zero in the database", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const booking = StaffBookingDetail.parse(
      await (
        await enter(owner.id, venue.id, {
          groundId: ground.id,
          ...at(hours, 0, 1),
          customer: walkIn,
        })
      ).json(),
    );
    await expect(
      prisma.bookingCharge.create({
        data: { bookingId: booking.id, type: "ADJUSTMENT", amount: 0, taxRate: 0, taxAmount: 0 },
      }),
    ).rejects.toThrow();
  });

  it("lists a customer's bookings here, latest first", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const first = StaffBookingDetail.parse(
      await (
        await enter(owner.id, venue.id, {
          groundId: ground.id,
          ...at(hours, 0, 1),
          customer: walkIn,
        })
      ).json(),
    );
    const second = StaffBookingDetail.parse(
      await (
        await enter(owner.id, venue.id, {
          groundId: ground.id,
          ...at(hours, 2, 3),
          customer: { venueCustomerId: first.customer.venueCustomerId },
        })
      ).json(),
    );
    const res = await asStaff(
      owner.id,
      "GET",
      `/venues/${venue.id}/customers/${first.customer.venueCustomerId}/bookings?limit=1`,
    );
    const page = StaffBookingPage.parse(await res.json());
    expect(page.data.map((booking) => booking.id)).toEqual([second.id]);
    const rest = StaffBookingPage.parse(
      await (
        await asStaff(
          owner.id,
          "GET",
          `/venues/${venue.id}/customers/${first.customer.venueCustomerId}/bookings?cursor=${page.nextCursor}`,
        )
      ).json(),
    );
    expect(rest.data.map((booking) => booking.id)).toEqual([first.id]);
  });
});
