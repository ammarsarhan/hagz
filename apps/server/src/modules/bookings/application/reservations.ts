import { bookHeldSlots, releaseSlots, type VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction, type Tx } from "@/platform/db/transaction";
import { BOOKING_EVENTS } from "../domain/events";
import { invalidTransition } from "../domain/status";
import { bookingNotFound, lockBooking, venueBookingNotFound } from "./booking-rows";
import { topUpVenue } from "./regulars";

// A regular's weekly reservation (PR 4.5, docs/regulars.md "Before the deadline"): confirmed or
// released by staff (after calling) or by the regular in the app, until its deadline. Nothing is paid
// through Hagz. A released week goes to the next overlapping regular in priority, if any.

type Who = { staff: VenueAccess } | { customerId: string };

const select = {
  id: true,
  venueId: true,
  status: true,
  expiresAt: true,
  customer: { select: { customerId: true } },
} as const;

const lockReservation = async (
  tx: Tx,
  who: Who,
  bookingId: string,
  to: "CONFIRMED" | "RELEASED",
  now: Date,
) => {
  const booking = await lockBooking(
    tx,
    bookingId,
    "staff" in who ? who.staff.venueId : null,
    select,
  );
  if (!booking) throw "staff" in who ? venueBookingNotFound() : bookingNotFound();
  if ("customerId" in who && booking.customer.customerId !== who.customerId) {
    throw bookingNotFound();
  }
  // Past its deadline it's released, even before the minute's sweep gets to it.
  if (booking.status !== "UNCONFIRMED" || !booking.expiresAt || booking.expiresAt <= now) {
    throw invalidTransition(booking.status === "UNCONFIRMED" ? "RELEASED" : booking.status, to);
  }
  return booking;
};

const actor = (who: Who) =>
  "staff" in who
    ? { staffId: who.staff.staffId, by: "STAFF" as const }
    : { customerId: who.customerId, by: "CUSTOMER" as const };

export const confirmReservation = async (
  who: Who,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  const { by, ...ids } = actor(who);
  await transaction(async (tx) => {
    const booking = await lockReservation(tx, who, bookingId, "CONFIRMED", now);
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", expiresAt: null },
    });
    await bookHeldSlots(tx, booking.id);
    await tx.bookingEvent.create({
      data: { bookingId: booking.id, type: BOOKING_EVENTS.CONFIRMED, data: { by }, ...ids },
    });
  });
};

export const releaseReservation = async (
  who: Who,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  const { by, ...ids } = actor(who);
  const venueId = await transaction(async (tx) => {
    const booking = await lockReservation(tx, who, bookingId, "RELEASED", now);
    await tx.booking.update({ where: { id: booking.id }, data: { status: "RELEASED" } });
    await releaseSlots(tx, [booking.id], now);
    await tx.bookingEvent.create({
      data: { bookingId: booking.id, type: BOOKING_EVENTS.RELEASED, data: { by }, ...ids },
    });
    return booking.venueId;
  });
  await topUpVenue(venueId, clock);
};
