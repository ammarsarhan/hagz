import { Booking, StaffBookingDetail } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { markBooking } from "@/modules/bookings/application/staff-decisions";
import { ALL_PERMISSIONS } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, HOUR, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Staff deciding on bookings (PR 4.2): approve or decline what waits for the venue, and mark how a
// game went.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const booked = async (token: string, body: object) => {
  const res = await book(token, body);
  expect(res.status).toBe(201);
  return Booking.parse(await res.json());
};

const slotsOf = (bookingId: string) =>
  prisma.groundSlot.findMany({ where: { bookingId }, orderBy: { startsAt: "asc" } });

describe("approving and declining", () => {
  it("approves a pay-at-venue booking straight to confirmed, booking its slots", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const pending = await booked(token, { groundId: ground.id, ...at(hours, 0, 2) });
    expect(pending.status).toBe("PENDING");

    const res = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/bookings/${pending.id}/approve`,
    );
    expect(res.status).toBe(200);
    const approved = StaffBookingDetail.parse(await res.json());
    expect(approved).toMatchObject({ status: "CONFIRMED", expiresAt: null, hold: false });
    expect((await slotsOf(pending.id)).map((slot) => slot.status)).toEqual(["BOOKED", "BOOKED"]);

    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: pending.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => [event.type, event.staffId, event.data])).toEqual([
      ["CREATED", null, { status: "PENDING" }],
      ["APPROVED", owner.id, { to: "CONFIRMED" }],
    ]);

    // Approving again finds it moved on.
    const again = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/bookings/${pending.id}/approve`,
    );
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({
      code: "BOOKING_STATUS_CONFLICT",
      bookingStatus: "CONFIRMED",
    });
  });

  it("approves an online-paid booking into its payment window", async () => {
    const { venue, ground, hours } = await aGround({
      settings: { autoConfirm: false, paymentMode: "PLATFORM", paymentWindow: 30 },
    });
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const pending = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });

    const before = Date.now();
    const res = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/bookings/${pending.id}/approve`,
    );
    const approved = StaffBookingDetail.parse(await res.json());
    expect(approved.status).toBe("HELD");
    const deadline = new Date(approved.expiresAt ?? 0).getTime();
    expect(deadline).toBeGreaterThanOrEqual(before + 30 * 60_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
    expect((await slotsOf(pending.id)).map((slot) => slot.status)).toEqual(["HELD"]);
  });

  it("declines as the venue's cancellation and frees the slots", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const pending = await booked(token, { groundId: ground.id, ...at(hours, 0, 2) });

    const res = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/bookings/${pending.id}/decline`,
      {
        reason: "The pitch is being resurfaced.",
      },
    );
    expect(res.status).toBe(200);
    const declined = StaffBookingDetail.parse(await res.json());
    expect(declined.status).toBe("CANCELLED");
    expect(declined.cancelled).toMatchObject({
      initiator: "VENUE",
      reason: "The pitch is being resurfaced.",
      refundPercent: 100,
      refundAmount: 0,
    });
    expect(await slotsOf(pending.id)).toEqual([]);

    // The time can be booked again.
    const { token: other } = await signedIn("+201009876543");
    expect((await book(other, { groundId: ground.id, ...at(hours, 0, 2) })).status).toBe(201);
  });

  it("won't approve one past its deadline, even before the sweep reaches it", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const pending = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    await prisma.booking.update({
      where: { id: pending.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/bookings/${pending.id}/approve`,
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ bookingStatus: "EXPIRED" });
  });

  it("needs bookings: manage, and only at the staff member's own venue", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const viewer = await staffAt(venue.id, {
      role: "MEMBER",
      permissions: { ...ALL_PERMISSIONS, bookings: "view" },
    });
    const { token } = await signedIn();
    const pending = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });

    const denied = await asStaff(
      viewer.id,
      "POST",
      `/venues/${venue.id}/bookings/${pending.id}/approve`,
    );
    expect(denied.status).toBe(403);

    const { venue: elsewhere } = await aGround();
    const stranger = await staffAt(elsewhere.id);
    const hidden = await asStaff(
      stranger.id,
      "POST",
      `/venues/${elsewhere.id}/bookings/${pending.id}/approve`,
    );
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toMatchObject({ code: "BOOKING_NOT_FOUND" });
  });
});

describe("marking how a game went", () => {
  it("marks after kick-off, corrects the mark, and leaves an unchanged mark alone", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const confirmed = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    expect(confirmed.status).toBe("CONFIRMED");
    const path = `/venues/${venue.id}/bookings/${confirmed.id}/mark`;

    const early = await asStaff(owner.id, "POST", path, { outcome: "COMPLETED" });
    expect(early.status).toBe(409);
    expect(await early.json()).toMatchObject({ code: "BOOKING_NOT_STARTED" });

    const actor = {
      venueId: venue.id,
      staffId: owner.id,
      role: "OWNER" as const,
      permissions: ALL_PERMISSIONS,
    };
    const afterGame = { now: () => new Date(Date.now() + 26 * HOUR) };
    await markBooking(actor, confirmed.id, { outcome: "NO_SHOW" }, afterGame);
    await markBooking(actor, confirmed.id, { outcome: "NO_SHOW" }, afterGame);
    await markBooking(actor, confirmed.id, { outcome: "COMPLETED" }, afterGame);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: confirmed.id },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    expect(stored.status).toBe("COMPLETED");
    expect(stored.events.map((event) => [event.type, event.data])).toEqual([
      ["CREATED", { status: "CONFIRMED" }],
      ["NO_SHOW", { from: "CONFIRMED" }],
      ["COMPLETED", { from: "NO_SHOW" }],
    ]);
  });

  it("won't mark a booking that never got confirmed", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const pending = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });

    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/bookings/${pending.id}/mark`, {
      outcome: "COMPLETED",
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ bookingStatus: "PENDING" });
  });
});
