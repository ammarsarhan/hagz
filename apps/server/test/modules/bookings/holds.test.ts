import { StaffBookingDetail } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { expireDueBookings } from "@/modules/bookings/application/expire-bookings";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Staff holds (PR 4.8): slots kept for someone deciding, then confirmed, extended once, released,
// or left to run out.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const held = async (staffId: string, venueId: string, body: object) => {
  const res = await asStaff(staffId, "POST", `/venues/${venueId}/holds`, body);
  expect(res.status).toBe(201);
  return StaffBookingDetail.parse(await res.json());
};

describe("staff holds", () => {
  it("holds free slots for a new walk-in, so nobody else can book them", async () => {
    const { venue, ground, hours } = await aGround({ settings: { staffHoldMinutes: 10 } });
    const owner = await staffAt(venue.id);
    const before = Date.now();
    const hold = await held(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 0, 2),
      customer: { name: "Karim", phone: "+20 100 555 1234" },
    });
    expect(hold).toMatchObject({
      status: "HELD",
      hold: true,
      source: "STAFF",
      paymentMode: "MANUAL",
      total: 80_000,
      customer: { name: "Karim", phone: "+201005551234", accountId: null },
      creator: { id: owner.id },
    });
    const deadline = new Date(hold.expiresAt ?? 0).getTime();
    expect(deadline).toBeGreaterThanOrEqual(before + 10 * 60_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 10 * 60_000);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } });
    expect(stored.commissionRate).toBe(0);

    const { token } = await signedIn();
    expect((await book(token, { groundId: ground.id, ...at(hours, 1, 2) })).status).toBe(409);

    // The same number again finds the same customer.
    const second = await held(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 2, 3),
      customer: { name: "Karim A.", phone: "+201005551234" },
    });
    expect(second.customer.venueCustomerId).toBe(hold.customer.venueCustomerId);
  });

  it("confirms a hold into a booking", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const hold = await held(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 0, 1),
      customer: { name: "Karim", phone: "+201005551234" },
    });

    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds/${hold.id}/confirm`);
    expect(res.status).toBe(200);
    expect(StaffBookingDetail.parse(await res.json())).toMatchObject({
      status: "CONFIRMED",
      hold: false,
      expiresAt: null,
    });
    const slots = await prisma.groundSlot.findMany({ where: { bookingId: hold.id } });
    expect(slots.map((slot) => slot.status)).toEqual(["BOOKED"]);

    const again = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds/${hold.id}/release`);
    expect(again.status).toBe(409);
  });

  it("extends a hold once", async () => {
    const { venue, ground, hours } = await aGround({ settings: { staffHoldMinutes: 20 } });
    const owner = await staffAt(venue.id);
    const hold = await held(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 0, 1),
      customer: { name: "Karim", phone: "+201005551234" },
    });

    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds/${hold.id}/extend`);
    expect(res.status).toBe(200);
    const extended = StaffBookingDetail.parse(await res.json());
    expect(new Date(extended.expiresAt ?? 0).getTime()).toBe(
      new Date(hold.expiresAt ?? 0).getTime() + 20 * 60_000,
    );

    const twice = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds/${hold.id}/extend`);
    expect(twice.status).toBe(409);
    expect(await twice.json()).toMatchObject({ code: "HOLD_ALREADY_EXTENDED" });
  });

  it("a new hold length is for holds made or extended from now on", async () => {
    const { venue, ground, hours } = await aGround({ settings: { staffHoldMinutes: 10 } });
    const owner = await staffAt(venue.id);
    const customer = { name: "Karim", phone: "+201005551234" };
    const before = await held(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 0, 1),
      customer,
    });
    const changed = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/booking-settings`, {
      staffHoldMinutes: 30,
    });
    expect(changed.status).toBe(200);

    // The hold already running keeps its deadline.
    const kept = await prisma.booking.findUniqueOrThrow({ where: { id: before.id } });
    expect(kept.expiresAt?.toISOString()).toBe(before.expiresAt);
    // A new one runs for the new length, and so does an extension.
    const after = await held(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 2, 3),
      customer,
    });
    expect(
      new Date(after.expiresAt ?? 0).getTime() - new Date(after.createdAt).getTime(),
    ).toBeGreaterThanOrEqual(30 * 60_000 - 5_000);
    const extended = StaffBookingDetail.parse(
      await (
        await asStaff(owner.id, "POST", `/venues/${venue.id}/holds/${before.id}/extend`)
      ).json(),
    );
    expect(new Date(extended.expiresAt ?? 0).getTime()).toBe(
      new Date(before.expiresAt ?? 0).getTime() + 30 * 60_000,
    );
  });

  it("releases a hold at once, or the sweep frees it when it runs out", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const customer = { name: "Karim", phone: "+201005551234" };
    const released = await held(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 0, 1),
      customer,
    });
    const lapsing = await held(owner.id, venue.id, {
      groundId: ground.id,
      ...at(hours, 1, 2),
      customer,
    });

    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds/${released.id}/release`);
    expect(res.status).toBe(200);
    expect(StaffBookingDetail.parse(await res.json()).status).toBe("EXPIRED");

    expect(await expireDueBookings({ now: () => new Date(Date.now() + 60 * 60_000) })).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: lapsing.id } })).status).toBe(
      "EXPIRED",
    );
    const { token } = await signedIn();
    expect((await book(token, { groundId: ground.id, ...at(hours, 0, 2) })).status).toBe(201);
  });

  it("refuses taken time and a customer from another venue", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    expect((await book(token, { groundId: ground.id, ...at(hours, 0, 1) })).status).toBe(201);

    const taken = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds`, {
      groundId: ground.id,
      ...at(hours, 0, 2),
      customer: { name: "Karim", phone: "+201005551234" },
    });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ code: "SLOT_UNAVAILABLE" });

    const { venue: elsewhere } = await aGround();
    const stranger = await prisma.venueCustomer.create({
      data: { venueId: elsewhere.id, name: "Someone" },
    });
    const foreign = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds`, {
      groundId: ground.id,
      ...at(hours, 2, 3),
      customer: { venueCustomerId: stranger.id },
    });
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
  });
});
