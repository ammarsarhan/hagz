import { bookHeldSlots, releaseSlots, type VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { BOOKING_EVENTS } from "../domain/events";
import { invalidTransition } from "../domain/status";
import { lockBooking } from "./booking-rows";

// Staff holds (PR 4.8, docs/rescheduling.md "Holding slots"): while staff are on the phone with
// someone deciding, or confirming a move with a customer, they keep the slots as a HELD booking of
// their own for staffHoldMinutes (made in staff-entry.ts). It can be confirmed, extended once, or
// released; otherwise the expiry sweep frees it like any unpaid hold.

const holdNotFound = () =>
  new AppError({ code: "HOLD_NOT_FOUND", status: 404, detail: "There's no such hold here." });

const alreadyExtended = () =>
  new AppError({
    code: "HOLD_ALREADY_EXTENDED",
    status: 409,
    detail: "A hold can be extended once. Confirm it or let it go.",
  });

const lockHold = async (
  tx: Tx,
  actor: VenueAccess,
  bookingId: string,
  attempted: "CONFIRMED" | "EXPIRED" | "HELD",
  now: Date,
) => {
  const hold = await lockBooking(tx, bookingId, actor.venueId, {
    id: true,
    status: true,
    creatorId: true,
    expiresAt: true,
    venue: { select: { settings: { select: { staffHoldMinutes: true } } } },
  });
  if (!hold?.creatorId) throw holdNotFound();
  if (hold.status !== "HELD") throw invalidTransition(hold.status, attempted);
  if (!hold.expiresAt || hold.expiresAt <= now) throw invalidTransition("EXPIRED", attempted);
  return { ...hold, expiresAt: hold.expiresAt };
};

// The customer said yes: the hold becomes a confirmed booking.
export const confirmHold = async (
  actor: VenueAccess,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const hold = await lockHold(tx, actor, bookingId, "CONFIRMED", now);
    await tx.booking.update({
      where: { id: hold.id },
      data: { status: "CONFIRMED", expiresAt: null },
    });
    await bookHeldSlots(tx, hold.id);
    await tx.bookingEvent.create({
      data: { bookingId: hold.id, type: BOOKING_EVENTS.CONFIRMED, staffId: actor.staffId },
    });
  });
};

// Another staffHoldMinutes on top of the deadline, once, so a hold can't keep slots off sale for
// long.
export const extendHold = async (
  actor: VenueAccess,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const hold = await lockHold(tx, actor, bookingId, "HELD", now);
    const extended = await tx.bookingEvent.findFirst({
      where: { bookingId: hold.id, type: BOOKING_EVENTS.HOLD_EXTENDED },
      select: { id: true },
    });
    if (extended) throw alreadyExtended();
    const minutes = hold.venue.settings?.staffHoldMinutes ?? 15;
    const expiresAt = new Date(hold.expiresAt.getTime() + minutes * 60_000);
    await tx.booking.update({ where: { id: hold.id }, data: { expiresAt } });
    await tx.bookingEvent.create({
      data: {
        bookingId: hold.id,
        type: BOOKING_EVENTS.HOLD_EXTENDED,
        staffId: actor.staffId,
        data: { expiresAt: expiresAt.toISOString() },
      },
    });
  });
};

// Lets the slots go at once. Ends EXPIRED, as if it had run out: a hold that didn't become a
// booking isn't a cancellation.
export const releaseHold = async (
  actor: VenueAccess,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const hold = await lockHold(tx, actor, bookingId, "EXPIRED", now);
    await tx.booking.update({ where: { id: hold.id }, data: { status: "EXPIRED" } });
    await releaseSlots(tx, [hold.id], now);
    await tx.bookingEvent.create({
      data: { bookingId: hold.id, type: BOOKING_EVENTS.HOLD_RELEASED, staffId: actor.staffId },
    });
  });
};
