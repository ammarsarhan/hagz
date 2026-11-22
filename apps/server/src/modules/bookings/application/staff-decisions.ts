import type { DeclineBooking, MarkBooking } from "@hagz/contracts";
import {
  bookHeldSlots,
  refreshCustomerCounters,
  releaseSlots,
  type VenueAccess,
} from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { BOOKING_EVENTS } from "../domain/events";
import { canMove, invalidTransition, paymentDeadline } from "../domain/status";
import { lockBooking, netPaid, venueBookingNotFound } from "./booking-rows";

// Staff deciding on bookings (PR 4.2): approving or declining one that waits for the venue, and
// marking how a game went. Each is a compare-and-set on the locked row, with its BookingEvent.

// How long after a game ends staff can still mark it, or change the mark (user, 2026-11-22). The
// sweep completes it at the end; after this, the mark is final.
export const MARK_WINDOW_HOURS = 24;

const notStarted = () =>
  new AppError({
    code: "BOOKING_NOT_STARTED",
    status: 409,
    detail: "A game can be marked once it has kicked off.",
  });

const markClosed = () =>
  new AppError({
    code: "MARK_WINDOW_CLOSED",
    status: 409,
    detail: `A game can be marked until ${MARK_WINDOW_HOURS} hours after it ends.`,
    extensions: { markWindowHours: MARK_WINDOW_HOURS },
  });

const pendingSelect = {
  id: true,
  status: true,
  startsAt: true,
  expiresAt: true,
  paymentMode: true,
  venue: { select: { settings: { select: { paymentWindow: true } } } },
} as const;

// A PENDING booking past its deadline has expired, even if the sweep hasn't reached it yet.
const lockPending = async (
  tx: Tx,
  actor: VenueAccess,
  bookingId: string,
  attempted: "CONFIRMED" | "CANCELLED",
  now: Date,
) => {
  const booking = await lockBooking(tx, bookingId, actor.venueId, pendingSelect);
  if (!booking) throw venueBookingNotFound();
  if (booking.status !== "PENDING") throw invalidTransition(booking.status, attempted);
  if (!booking.expiresAt || booking.expiresAt <= now) throw invalidTransition("EXPIRED", attempted);
  return booking;
};

// Approves a booking. With something to pay online it then waits for payment (HELD) for the
// venue's payment window, never past kick-off; otherwise it's confirmed.
export const approveBooking = async (
  actor: VenueAccess,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const booking = await lockPending(tx, actor, bookingId, "CONFIRMED", now);
    const payable = booking.paymentMode !== "MANUAL";
    const to = payable ? "HELD" : "CONFIRMED";
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: to,
        expiresAt: payable
          ? paymentDeadline(now, booking.startsAt, booking.venue.settings?.paymentWindow ?? null)
          : null,
      },
    });
    if (!payable) await bookHeldSlots(tx, booking.id);
    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        type: BOOKING_EVENTS.APPROVED,
        staffId: actor.staffId,
        data: { to },
      },
    });
  });
};

// Declines a booking: cancelled as the venue's decision, so anything paid would be refunded in
// full (nothing is, while it waits for approval), and its slots are free again.
export const declineBooking = async (
  actor: VenueAccess,
  bookingId: string,
  { reason }: DeclineBooking,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const booking = await lockPending(tx, actor, bookingId, "CANCELLED", now);
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", expiresAt: null },
    });
    await tx.cancellation.create({
      data: {
        bookingId: booking.id,
        initiator: "VENUE",
        reason: reason ?? null,
        refundPercent: 100,
        refundAmount: await netPaid(tx, [booking.id]),
      },
    });
    await releaseSlots(tx, [booking.id], now);
    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        type: BOOKING_EVENTS.DECLINED,
        staffId: actor.staffId,
        data: reason ? { reason } : {},
      },
    });
  });
};

// Marks a confirmed game played or a no-show once it has kicked off, or corrects the mark, until
// MARK_WINDOW_HOURS after it ends. Marking it the way it already is changes nothing.
export const markBooking = async (
  actor: VenueAccess,
  bookingId: string,
  { outcome }: MarkBooking,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const booking = await lockBooking(tx, bookingId, actor.venueId, {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      customerId: true,
    });
    if (!booking) throw venueBookingNotFound();
    if (booking.status === outcome) return;
    if (!canMove(booking.status, outcome)) throw invalidTransition(booking.status, outcome);
    if (booking.startsAt > now) throw notStarted();
    if (now.getTime() > booking.endsAt.getTime() + MARK_WINDOW_HOURS * 60 * 60_000) {
      throw markClosed();
    }
    await tx.booking.update({ where: { id: booking.id }, data: { status: outcome } });
    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        type: BOOKING_EVENTS[outcome],
        staffId: actor.staffId,
        data: { from: booking.status },
      },
    });
    await refreshCustomerCounters(tx, [booking.customerId]);
  });
};
