import { Booking, StaffBookingDetail, SwappedBookings } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { acceptMove, rejectMove } from "@/modules/bookings/application/move-response";
import { prisma } from "@/platform/db/prisma";
import {
  aGround,
  asCustomer,
  asStaff,
  at,
  book,
  HOUR,
  moreHours,
  signedIn,
  staffAt,
} from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Moving and swapping bookings, and the player's answer (PR 4.8, docs/rescheduling.md).

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const booked = async (token: string, body: object) => {
  const res = await book(token, body);
  expect(res.status).toBe(201);
  return Booking.parse(await res.json());
};

const move = async (staffId: string, venueId: string, bookingId: string, body: object) =>
  asStaff(staffId, "POST", `/venues/${venueId}/bookings/${bookingId}/move`, body);

const slotStates = async (groundId: string, hours: Date[]) =>
  (
    await prisma.groundSlot.findMany({
      where: { groundId, startsAt: { in: hours } },
      orderBy: { startsAt: "asc" },
      select: { status: true, bookingId: true },
    })
  ).map((slot) => [slot.status, slot.bookingId]);

describe("moving a booking", () => {
  it("moves to a later time overlapping its own, at the new slots' prices", async () => {
    // [0] and [1] are base hours at 400, [2] and [3] peak at 600.
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const original = await booked(token, { groundId: ground.id, ...at(hours, 0, 2) });

    const res = await move(owner.id, venue.id, original.id, {
      groundId: ground.id,
      ...at(hours, 1, 3),
      reason: "Floodlights out early",
    });
    expect(res.status).toBe(200);
    const moved = StaffBookingDetail.parse(await res.json());
    expect(moved).toMatchObject({
      status: "CONFIRMED",
      total: 100_000,
      customer: { phone: "+201001234567" },
      movedFrom: { bookingId: original.id, type: "MOVE" },
    });
    expect(moved.charges.map((charge) => charge.amount)).toEqual([40_000, 60_000]);

    const old = await prisma.booking.findUniqueOrThrow({
      where: { id: original.id },
      include: { rescheduledTo: true, events: { orderBy: { createdAt: "asc" } } },
    });
    expect(old.status).toBe("RESCHEDULED");
    expect(old.rescheduledTo).toEqual([
      expect.objectContaining({
        toBookingId: moved.id,
        staffId: owner.id,
        reason: "Floodlights out early",
        priceDifference: 20_000,
      }),
    ]);
    expect(old.events.at(-1)).toMatchObject({ type: "RESCHEDULED", staffId: owner.id });

    // [0] is free again, [1] and [2] are the new booking's.
    expect(await slotStates(ground.id, hours.slice(0, 3))).toEqual([
      ["AVAILABLE", null],
      ["BOOKED", moved.id],
      ["BOOKED", moved.id],
    ]);

    // The player's list shows the new booking only, with the move to answer.
    const mine = (await (await asCustomer(token, "GET", "/bookings")).json()) as {
      data: { id: string }[];
    };
    expect(mine.data.map((booking) => booking.id)).toEqual([moved.id]);
    const view = Booking.parse(
      await (await asCustomer(token, "GET", `/bookings/${moved.id}`)).json(),
    );
    expect(view.move).toMatchObject({
      type: "MOVE",
      from: { startsAt: hours[0]?.toISOString(), total: 80_000 },
      priceDifference: 20_000,
      reason: "Floodlights out early",
      canMoveBack: true,
    });
  });

  it("moves into time it held first, ending the hold in the same step", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const original = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    const venueCustomer = await prisma.booking.findUniqueOrThrow({ where: { id: original.id } });

    const holdRes = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds`, {
      groundId: ground.id,
      ...at(hours, 3, 4),
      customer: { venueCustomerId: venueCustomer.customerId },
    });
    const hold = StaffBookingDetail.parse(await holdRes.json());

    // Without the hold the time is taken.
    const blocked = await move(owner.id, venue.id, original.id, {
      groundId: ground.id,
      ...at(hours, 3, 4),
    });
    expect(blocked.status).toBe(409);

    const res = await move(owner.id, venue.id, original.id, {
      groundId: ground.id,
      ...at(hours, 3, 4),
      holdId: hold.id,
    });
    expect(res.status).toBe(200);
    const moved = StaffBookingDetail.parse(await res.json());
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe(
      "EXPIRED",
    );
    expect(await slotStates(ground.id, [hours[0] ?? new Date(), hours[3] ?? new Date()])).toEqual([
      ["AVAILABLE", null],
      ["BOOKED", moved.id],
    ]);
  });

  it("refuses taken time, the same time, and bookings that can't move", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const mine = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    const { token: other } = await signedIn("+201009876543");
    await booked(other, { groundId: ground.id, ...at(hours, 2, 3) });

    const taken = await move(owner.id, venue.id, mine.id, {
      groundId: ground.id,
      ...at(hours, 2, 3),
    });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ code: "SLOT_UNAVAILABLE" });

    const same = await move(owner.id, venue.id, mine.id, {
      groundId: ground.id,
      ...at(hours, 0, 1),
    });
    expect(same.status).toBe(422);

    const all = await moreHours(ground, hours, 4);
    const tooLong = await move(owner.id, venue.id, mine.id, {
      groundId: ground.id,
      ...at(all, 4, 8),
    });
    expect(tooLong.status).toBe(422);
    expect(await tooLong.json()).toMatchObject({ maximumSlots: 3 });

    await prisma.booking.update({ where: { id: mine.id }, data: { status: "COMPLETED" } });
    const done = await move(owner.id, venue.id, mine.id, {
      groundId: ground.id,
      ...at(hours, 1, 2),
    });
    expect(done.status).toBe(409);
    expect(await done.json()).toMatchObject({ code: "BOOKING_NOT_MOVABLE" });
  });
});

describe("swapping two bookings", () => {
  it("gives each the other's time, linked as one swap", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const { token: other } = await signedIn("+201009876543");
    const a = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    const b = await booked(other, { groundId: ground.id, ...at(hours, 2, 3) });

    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/bookings/${a.id}/swap`, {
      withBookingId: b.id,
    });
    expect(res.status).toBe(200);
    const [newA, newB] = SwappedBookings.parse(await res.json()).data;
    expect(newA).toMatchObject({
      startsAt: hours[2]?.toISOString(),
      total: 60_000,
      customer: { phone: "+201001234567" },
    });
    expect(newB).toMatchObject({
      startsAt: hours[0]?.toISOString(),
      total: 40_000,
      customer: { phone: "+201009876543" },
    });

    const links = await prisma.rescheduling.findMany({ where: { type: "SWAP" } });
    expect(links).toHaveLength(2);
    expect(new Set(links.map((link) => link.groupId)).size).toBe(1);
    expect(await slotStates(ground.id, [hours[0] ?? new Date(), hours[2] ?? new Date()])).toEqual([
      ["BOOKED", newB.id],
      ["BOOKED", newA.id],
    ]);

    // A swapped booking can be rejected, never moved back.
    const view = Booking.parse(
      await (await asCustomer(token, "GET", `/bookings/${newA.id}`)).json(),
    );
    expect(view.move).toMatchObject({ type: "SWAP", canMoveBack: false });
    const back = await asCustomer(token, "POST", `/bookings/${newA.id}/move/back`);
    expect(back.status).toBe(409);
  });
});

describe("answering a move", () => {
  const movedBooking = async () => {
    const { venue, ground, hours } = await aGround({ settings: { paymentMode: "PLATFORM" } });
    const owner = await staffAt(venue.id);
    const { customer, token } = await signedIn();
    const original = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    const res = await move(owner.id, venue.id, original.id, {
      groundId: ground.id,
      ...at(hours, 2, 3),
    });
    const moved = StaffBookingDetail.parse(await res.json());
    return { venue, ground, hours, owner, customer, token, original, moved };
  };

  it("accepting closes the choice", async () => {
    const { token, moved } = await movedBooking();
    const res = await asCustomer(token, "POST", `/bookings/${moved.id}/move/accept`);
    expect(res.status).toBe(200);
    expect(Booking.parse(await res.json()).move).toBeNull();
    const again = await asCustomer(token, "POST", `/bookings/${moved.id}/move/reject`);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "MOVE_NOT_OPEN" });
  });

  it("rejecting cancels it as the venue's, with a full refund, and frees the time", async () => {
    const { ground, hours, token, moved } = await movedBooking();
    const res = await asCustomer(token, "POST", `/bookings/${moved.id}/move/reject`);
    expect(res.status).toBe(200);
    expect(Booking.parse(await res.json())).toMatchObject({ status: "CANCELLED", move: null });
    const cancellation = await prisma.cancellation.findUniqueOrThrow({
      where: { bookingId: moved.id },
    });
    expect(cancellation).toMatchObject({ initiator: "VENUE", refundPercent: 100 });
    const events = await prisma.bookingEvent.findMany({ where: { bookingId: moved.id } });
    expect(events.map((event) => event.type)).toContain("MOVE_REJECTED");
    expect(await slotStates(ground.id, [hours[2] ?? new Date()])).toEqual([["AVAILABLE", null]]);
  });

  it("moving back restores the original time and charges", async () => {
    const { ground, hours, token, original, moved } = await movedBooking();
    expect(moved.total).toBe(60_000);
    const res = await asCustomer(token, "POST", `/bookings/${moved.id}/move/back`);
    expect(res.status).toBe(200);
    const back = Booking.parse(await res.json());
    expect(back).toMatchObject({
      startsAt: original.startsAt,
      total: 40_000,
      charges: original.charges,
      move: null,
    });
    const link = await prisma.rescheduling.findFirstOrThrow({ where: { toBookingId: back.id } });
    expect(link).toMatchObject({ type: "MOVE", staffId: null, priceDifference: -20_000 });
    expect(await slotStates(ground.id, [hours[0] ?? new Date(), hours[2] ?? new Date()])).toEqual([
      ["HELD", back.id],
      ["AVAILABLE", null],
    ]);
  });

  it("can't move back once the original time is taken", async () => {
    const { ground, hours, token, moved } = await movedBooking();
    const { token: other } = await signedIn("+201009876543");
    await booked(other, { groundId: ground.id, ...at(hours, 0, 1) });

    const view = Booking.parse(
      await (await asCustomer(token, "GET", `/bookings/${moved.id}`)).json(),
    );
    expect(view.move?.canMoveBack).toBe(false);
    const res = await asCustomer(token, "POST", `/bookings/${moved.id}/move/back`);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("closes after 24 hours, and only the player can answer", async () => {
    const { customer, token, moved } = await movedBooking();
    const { customer: stranger } = await signedIn("+201009876543");
    await expect(acceptMove(stranger.id, moved.id)).rejects.toMatchObject({
      code: "BOOKING_NOT_FOUND",
    });

    // The game is 26 hours out, so the window is the 24 hours after the move.
    const movedAt = (
      await prisma.rescheduling.findFirstOrThrow({ where: { toBookingId: moved.id } })
    ).createdAt.getTime();
    const dayLater = { now: () => new Date(movedAt + 24 * HOUR + 1000) };
    await expect(rejectMove(customer.id, moved.id, dayLater)).rejects.toMatchObject({
      code: "MOVE_NOT_OPEN",
    });
    const view = Booking.parse(
      await (await asCustomer(token, "GET", `/bookings/${moved.id}`)).json(),
    );
    expect(new Date(view.move?.respondBy ?? 0).getTime()).toBe(movedAt + 24 * HOUR);
    const withinADay = { now: () => new Date(movedAt + 23 * HOUR) };
    await expect(acceptMove(customer.id, moved.id, withinADay)).resolves.toBeUndefined();
  });

  it("keeps a move made on a longer booking with more hours available", async () => {
    const { venue, ground, hours } = await aGround();
    const all = await moreHours(ground, hours, 2);
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const original = await booked(token, { groundId: ground.id, ...at(all, 0, 3) });
    const res = await move(owner.id, venue.id, original.id, {
      groundId: ground.id,
      ...at(all, 3, 6),
    });
    expect(res.status).toBe(200);
    expect(StaffBookingDetail.parse(await res.json()).total).toBe(140_000);
  });
});
