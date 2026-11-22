import { randomUUID } from "node:crypto";
import type { MoveBooking, SwapBookings } from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import {
  HORIZON_DAYS,
  lockSlotsInRange,
  reassignSlots,
  releaseSlots,
  type RangeSlot,
  type VenueAccess,
} from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { BOOKING_EVENTS } from "../domain/events";
import {
  chargesAfterMove,
  checkMovable,
  depositAfterMove,
  type StoredCharge,
} from "../domain/moves";
import { checkLength, checkRange, coversExactly, slotUnavailable } from "../domain/rules";
import { invalidTransition } from "../domain/status";
import { lockBookings, newCode, venueBookingNotFound, withFreshCode } from "./booking-rows";

// Moving and swapping bookings (PR 4.8, docs/rescheduling.md). A move never edits the booking: the
// old one ends RESCHEDULED and a new one takes over its customer, status and terms at the new
// slots' prices, linked by a Rescheduling row. Everything happens in one transaction with the slots
// locked, so they're never free in between for someone else to take.

const groundNotFound = () =>
  new AppError({ code: "GROUND_NOT_FOUND", status: 404, detail: "There's no such ground here." });

const groundResting = () =>
  new AppError({
    code: "GROUND_UNAVAILABLE",
    status: 409,
    detail: "This ground isn't taking bookings for now.",
  });

const holdUnusable = () =>
  new AppError({
    code: "HOLD_NOT_FOUND",
    status: 409,
    detail: "That hold has ended. Pick the time again.",
  });

const sameTime = () =>
  new AppError({
    code: "INVALID_BOOKING_TIME",
    status: 422,
    detail: "The booking is already at that time on that ground.",
  });

const sameBooking = () =>
  new AppError({
    code: "INVALID_SWAP",
    status: 422,
    detail: "Pick another booking to swap with.",
  });

// A ground of the venue that's taking bookings, with its shortest and longest booking.
export const targetGround = async (tx: Tx, venueId: string, groundId: string) => {
  const ground = await tx.ground.findFirst({
    where: { id: groundId, venueId, status: { not: "DELETED" } },
    select: {
      id: true,
      status: true,
      settings: { select: { minimumSlots: true, maximumSlots: true } },
    },
  });
  if (!ground) throw groundNotFound();
  if (ground.status !== "ACTIVE" || !ground.settings) throw groundResting();
  return { id: ground.id, ...ground.settings };
};

export const movingSelect = {
  id: true,
  venueId: true,
  groundId: true,
  customerId: true,
  creatorId: true,
  regularId: true,
  status: true,
  startsAt: true,
  endsAt: true,
  note: true,
  expiresAt: true,
  total: true,
  depositAmount: true,
  paymentMode: true,
  commissionRate: true,
  cancellationPolicy: true,
  cancellationTiers: true,
  charges: {
    orderBy: [{ type: "asc" }, { startsAt: "asc" }, { id: "asc" }],
    select: {
      type: true,
      startsAt: true,
      tier: true,
      optionId: true,
      discountId: true,
      pricing: true,
      amount: true,
      taxRate: true,
      taxAmount: true,
    },
  },
} as const satisfies Prisma.BookingSelect;

export type Moving = Prisma.BookingGetPayload<{ select: typeof movingSelect }>;

export interface Target {
  groundId: string;
  startsAt: Date;
  endsAt: Date;
}

const rangeOf = (booking: Moving): Target => ({
  groundId: booking.groundId,
  startsAt: booking.startsAt,
  endsAt: booking.endsAt,
});

// Locks a target's slots and checks they run back to back over it, each free or held by one of the
// bookings in `mayTake` (the moving booking itself, its hold, the other side of a swap).
export const claimTarget = async (
  tx: Tx,
  venueId: string,
  target: Target,
  mayTake: ReadonlySet<string>,
  { checkLengthToo = true } = {},
): Promise<RangeSlot[]> => {
  const ground = await targetGround(tx, venueId, target.groundId);
  const slots = await lockSlotsInRange(tx, ground.id, target.startsAt, target.endsAt);
  const usable = slots.every(
    (slot) =>
      slot.status === "AVAILABLE" ||
      (slot.status !== "BLOCKED" && slot.bookingId !== null && mayTake.has(slot.bookingId)),
  );
  if (!usable || !coversExactly(slots, target.startsAt, target.endsAt)) throw slotUnavailable();
  if (checkLengthToo) checkLength(slots.length, ground.minimumSlots, ground.maximumSlots);
  return slots;
};

// Ends a booking as moved. It's locked, so its status can't have changed since it was read.
export const retire = async (tx: Tx, booking: Moving) => {
  const { count } = await tx.booking.updateMany({
    where: { id: booking.id, status: booking.status },
    data: { status: "RESCHEDULED" },
  });
  if (count === 0) throw invalidTransition(booking.status, "RESCHEDULED");
};

export interface Link {
  type: "MOVE" | "SWAP";
  groupId: string | null;
  // Who moved it: a staff member, or the player moving it back (their account).
  staffId: string | null;
  accountId: string | null;
  reason: string | null;
}

// The booking that replaces `from` on the claimed slots: same customer, status, deadline, regular,
// note and terms; the given charges. Run after `from` is retired, so the database's no-overlap
// constraint doesn't see two live bookings on the same time.
export const successor = async (
  tx: Tx,
  from: Moving,
  slots: readonly RangeSlot[],
  target: Target,
  price: { lines: readonly StoredCharge[]; total: number; deposit: number | null },
  link: Link,
): Promise<string> => {
  const actor = { staffId: link.staffId, customerId: link.accountId };
  const { id } = await tx.booking.create({
    data: {
      venueId: from.venueId,
      groundId: target.groundId,
      customerId: from.customerId,
      creatorId: from.creatorId,
      regularId: from.regularId,
      code: newCode(),
      status: from.status,
      startsAt: target.startsAt,
      endsAt: target.endsAt,
      note: from.note,
      expiresAt: from.expiresAt,
      total: price.total,
      depositAmount: price.deposit,
      paymentMode: from.paymentMode,
      commissionRate: from.commissionRate,
      cancellationPolicy: from.cancellationPolicy,
      cancellationTiers: from.cancellationTiers as Prisma.InputJsonValue,
      charges: {
        create: price.lines.map((line) => ({
          type: line.type,
          startsAt: line.startsAt,
          tier: line.tier,
          optionId: line.optionId,
          discountId: line.discountId,
          pricing: line.pricing,
          amount: line.amount,
          taxRate: line.taxRate,
          taxAmount: line.taxAmount,
        })),
      },
      events: {
        create: {
          type: BOOKING_EVENTS.CREATED,
          ...actor,
          data: { status: from.status, from: from.id, type: link.type },
        },
      },
    },
    select: { id: true },
  });
  await reassignSlots(
    tx,
    slots.map((slot) => slot.id),
    id,
    from.status === "CONFIRMED" ? "BOOKED" : "HELD",
  );
  await tx.rescheduling.create({
    data: {
      venueId: from.venueId,
      fromBookingId: from.id,
      toBookingId: id,
      type: link.type,
      groupId: link.groupId,
      staffId: link.staffId,
      reason: link.reason,
      priceDifference: price.total - from.total,
    },
  });
  await tx.bookingEvent.create({
    data: {
      bookingId: from.id,
      type: BOOKING_EVENTS.RESCHEDULED,
      ...actor,
      data: { to: id, type: link.type, ...(link.groupId && { groupId: link.groupId }) },
    },
  });
  return id;
};

const repriced = (from: Moving, slots: readonly RangeSlot[]) => {
  const price = chargesAfterMove(from.charges, slots);
  return { ...price, deposit: depositAfterMove(from.depositAmount, from.total, price.total) };
};

// Moves a booking to another time, ground or both. Free target slots can be held first (holdId);
// the hold ends in the same step. Returns the new booking's id.
export const moveBooking = async (
  actor: VenueAccess,
  bookingId: string,
  body: MoveBooking,
  clock: Clock = systemClock,
): Promise<string> => {
  const now = clock.now();
  const target: Target = {
    groundId: body.groundId,
    startsAt: new Date(body.startsAt),
    endsAt: new Date(body.endsAt),
  };
  checkRange(target.startsAt, target.endsAt, { now, minimumNotice: 0, horizonDays: HORIZON_DAYS });

  return withFreshCode(() =>
    transaction(async (tx) => {
      const ids = body.holdId ? [bookingId, body.holdId] : [bookingId];
      const rows = await lockBookings(tx, ids, actor.venueId, movingSelect);
      const booking = rows.find((row) => row.id === bookingId);
      if (!booking) throw venueBookingNotFound();
      checkMovable(booking, now);
      const current = rangeOf(booking);
      if (
        current.groundId === target.groundId &&
        current.startsAt.getTime() === target.startsAt.getTime() &&
        current.endsAt.getTime() === target.endsAt.getTime()
      ) {
        throw sameTime();
      }

      const hold = body.holdId ? rows.find((row) => row.id === body.holdId) : undefined;
      if (body.holdId) {
        const usable =
          hold?.status === "HELD" &&
          hold.creatorId !== null &&
          hold.expiresAt !== null &&
          hold.expiresAt > now &&
          hold.id !== booking.id;
        if (!usable) throw holdUnusable();
      }

      const mayTake = new Set([booking.id, ...(hold ? [hold.id] : [])]);
      const slots = await claimTarget(tx, actor.venueId, target, mayTake);
      if (hold) {
        await tx.booking.update({ where: { id: hold.id }, data: { status: "EXPIRED" } });
        await tx.bookingEvent.create({
          data: {
            bookingId: hold.id,
            type: BOOKING_EVENTS.HOLD_RELEASED,
            staffId: actor.staffId,
            data: { bookingId: booking.id },
          },
        });
      }
      await retire(tx, booking);
      const id = await successor(tx, booking, slots, target, repriced(booking, slots), {
        type: "MOVE",
        groupId: null,
        staffId: actor.staffId,
        accountId: null,
        reason: body.reason ?? null,
      });
      // Whatever the old booking and the hold still hold, the move didn't take.
      await releaseSlots(tx, [...mayTake], now);
      return id;
    }),
  );
};

// Swaps two bookings' times: each takes the other's ground and time, keeping its own customer and
// terms at its new slots' prices. Both moves share a groupId. Returns the two new bookings' ids, this
// one's first.
export const swapBookings = async (
  actor: VenueAccess,
  bookingId: string,
  { withBookingId, reason }: SwapBookings,
  clock: Clock = systemClock,
): Promise<[string, string]> => {
  if (bookingId === withBookingId) throw sameBooking();
  const now = clock.now();

  return withFreshCode(() =>
    transaction(async (tx) => {
      const rows = await lockBookings(tx, [bookingId, withBookingId], actor.venueId, movingSelect);
      const a = rows.find((row) => row.id === bookingId);
      const b = rows.find((row) => row.id === withBookingId);
      if (!a || !b) throw venueBookingNotFound();
      checkMovable(a, now);
      checkMovable(b, now);

      // Slots locked in one fixed order (ground, then time), so two swaps can't deadlock.
      const mayTake = new Set([a.id, b.id]);
      const sides = [
        { from: a, target: rangeOf(b) },
        { from: b, target: rangeOf(a) },
      ];
      const ordered = [...sides].sort(
        (x, y) =>
          x.target.groundId.localeCompare(y.target.groundId) ||
          x.target.startsAt.getTime() - y.target.startsAt.getTime(),
      );
      const claimed = new Map<string, RangeSlot[]>();
      for (const side of ordered) {
        claimed.set(side.from.id, await claimTarget(tx, actor.venueId, side.target, mayTake));
      }

      await retire(tx, a);
      await retire(tx, b);
      const link: Link = {
        type: "SWAP",
        groupId: randomUUID(),
        staffId: actor.staffId,
        accountId: null,
        reason: reason ?? null,
      };
      const take = (from: Moving, target: Target) => {
        const slots = claimed.get(from.id) ?? [];
        return successor(tx, from, slots, target, repriced(from, slots), link);
      };
      const ids: [string, string] = [await take(a, rangeOf(b)), await take(b, rangeOf(a))];
      await releaseSlots(tx, [a.id, b.id], now);
      return ids;
    }),
  );
};
