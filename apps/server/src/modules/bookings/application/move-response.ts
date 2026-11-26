import type { BookingMove } from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { nameIn, releaseSlots } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { BOOKING_EVENTS } from "../domain/events";
import { MOVABLE, respondBy } from "../domain/moves";
import { coversExactly } from "../domain/rules";
import { invalidTransition } from "../domain/status";
import { bookingNotFound, lockBooking, moveChain, netPaid, withFreshCode } from "./booking-rows";
import { cancelListings } from "./listings";
import { claimTarget, movingSelect, retire, successor, type Moving } from "./rescheduling";

// The player answering a move staff made (PR 4.8, docs/rescheduling.md "Rejecting a move"): accept
// it, reject it as a venue cancellation with a full refund, or move it back while the original time
// is free. Open for 24 hours after the move or until kick-off, whichever is first; silence accepts.
// Nothing is stored for "open": it's worked out from the booking's origin and its events.

const moveNotOpen = () =>
  new AppError({
    code: "MOVE_NOT_OPEN",
    status: 409,
    detail: "There's no change to this booking left to answer.",
  });

const cantMoveBack = () =>
  new AppError({
    code: "SLOT_UNAVAILABLE",
    status: 409,
    detail: "The original time has been taken, so the booking can't go back to it.",
  });

const names = { translations: { select: { language: true, name: true } } } as const;

export const originSelect = {
  status: true,
  startsAt: true,
  customer: { select: { customerId: true } },
  rescheduledFrom: {
    select: {
      type: true,
      staffId: true,
      reason: true,
      priceDifference: true,
      createdAt: true,
      from: { select: { ...movingSelect, ground: { select: { id: true, ...names } } } },
    },
  },
  events: { where: { type: BOOKING_EVENTS.MOVE_ACCEPTED }, select: { id: true }, take: 1 },
} as const satisfies Prisma.BookingSelect;

type WithOrigin = Prisma.BookingGetPayload<{ select: typeof originSelect }>;

// The move still waiting for the player's answer, if there is one. A move the player made
// themselves (moving it back) has no staff member and isn't one to answer.
export const openMove = (booking: WithOrigin, now: Date) => {
  const origin = booking.rescheduledFrom;
  if (!origin || origin.type === "REFILL" || origin.staffId === null) return null;
  if (booking.events.length > 0 || !MOVABLE.includes(booking.status)) return null;
  const deadline = respondBy(origin.createdAt, booking.startsAt);
  if (now >= deadline) return null;
  return { ...origin, type: origin.type, respondBy: deadline };
};

// Whether the original slots are free again (or the booking's own), and not started: never after
// a swap, whose other side took them.
const originalFree = async (bookingId: string, type: string, original: Moving, now: Date) => {
  if (type !== "MOVE" || original.startsAt <= now) return false;
  const slots = await prisma.groundSlot.findMany({
    where: {
      groundId: original.groundId,
      startsAt: { gte: original.startsAt, lt: original.endsAt },
      ground: { status: "ACTIVE" },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true, status: true, bookingId: true },
  });
  return (
    slots.every((slot) => slot.status === "AVAILABLE" || slot.bookingId === bookingId) &&
    coversExactly(slots, original.startsAt, original.endsAt)
  );
};

// For the player's booking view: what changed and what they can still do about it.
export const moveFor = async (
  bookingId: string,
  language: Language,
  clock: Clock = systemClock,
): Promise<BookingMove | null> => {
  const now = clock.now();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: originSelect,
  });
  const move = openMove(booking, now);
  if (!move) return null;
  return {
    type: move.type,
    from: {
      ground: { id: move.from.ground.id, name: nameIn(move.from.ground.translations, language) },
      startsAt: move.from.startsAt.toISOString(),
      endsAt: move.from.endsAt.toISOString(),
      total: move.from.total,
    },
    priceDifference: move.priceDifference ?? 0,
    reason: move.reason,
    respondBy: move.respondBy.toISOString(),
    canMoveBack: await originalFree(bookingId, move.type, move.from, now),
    movedAt: move.createdAt.toISOString(),
  };
};

// The player's booking, locked, with the move they can still answer.
const lockOpenMove = async (tx: Tx, customerId: string, bookingId: string, now: Date) => {
  const booking = await lockBooking(tx, bookingId, null, { ...movingSelect, ...originSelect });
  if (booking?.customer.customerId !== customerId) throw bookingNotFound();
  const move = openMove(booking, now);
  if (!move) throw moveNotOpen();
  return { booking, move };
};

export const acceptMove = async (
  customerId: string,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const { booking } = await lockOpenMove(tx, customerId, bookingId, now);
    await tx.bookingEvent.create({
      data: { bookingId: booking.id, type: BOOKING_EVENTS.MOVE_ACCEPTED, customerId },
    });
  });
};

// Cancelled as the venue's cancellation: everything paid along the move chain is refunded and no
// commission is due. The refunds themselves are Phase 5's.
export const rejectMove = async (
  customerId: string,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const { booking } = await lockOpenMove(tx, customerId, bookingId, now);
    const { count } = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status: "CANCELLED", expiresAt: null },
    });
    if (count === 0) throw invalidTransition(booking.status, "CANCELLED");
    await tx.cancellation.create({
      data: {
        bookingId: booking.id,
        initiator: "VENUE",
        reason: "The player rejected a change the venue made.",
        refundPercent: 100,
        refundAmount: await netPaid(tx, await moveChain(tx, booking.id)),
      },
    });
    await releaseSlots(tx, [booking.id], now);
    await cancelListings(tx, [booking.id], now);
    await tx.bookingEvent.create({
      data: { bookingId: booking.id, type: BOOKING_EVENTS.MOVE_REJECTED, customerId },
    });
  });
};

// Back to the original ground and time, at the original's charges, so it never costs more than
// first agreed. Another MOVE, made by the player. Returns the new booking's id.
export const moveBack = async (
  customerId: string,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<string> => {
  const now = clock.now();
  return withFreshCode(() =>
    transaction(async (tx) => {
      const { booking, move } = await lockOpenMove(tx, customerId, bookingId, now);
      const original = move.from;
      if (move.type !== "MOVE" || original.startsAt <= now) throw cantMoveBack();
      const target = {
        groundId: original.groundId,
        startsAt: original.startsAt,
        endsAt: original.endsAt,
      };
      // The ground's booking lengths may have changed since; the original was fine when it was made.
      const slots = await claimTarget(tx, booking.venueId, target, new Set([booking.id]), {
        checkLengthToo: false,
      }).catch((error: unknown) => {
        if (error instanceof AppError && error.code === "SLOT_UNAVAILABLE") throw cantMoveBack();
        throw error;
      });
      await retire(tx, booking);
      const id = await successor(
        tx,
        booking,
        slots,
        target,
        { lines: original.charges, total: original.total, deposit: original.depositAmount },
        { type: "MOVE", groupId: null, staffId: null, accountId: customerId, reason: null },
        now,
      );
      await releaseSlots(tx, [booking.id], now);
      return id;
    }),
  );
};
