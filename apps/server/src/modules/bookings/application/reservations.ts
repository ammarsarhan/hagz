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

// Staff, the regular signed in to the app, or whoever holds a confirm link (its token stands for the
// regular: it was made for this week, so who opened it isn't checked).
export type Who =
  { staff: VenueAccess } | { customerId: string } | { link: { customerId: string | null } };

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

// Who answered, on the booking's event: by STAFF or by the CUSTOMER, and `via: "LINK"` from a
// confirm link.
const actor = (who: Who) =>
  "staff" in who
    ? { ids: { staffId: who.staff.staffId }, data: { by: "STAFF" as const } }
    : "link" in who
      ? {
          ids: who.link.customerId ? { customerId: who.link.customerId } : {},
          data: { by: "CUSTOMER" as const, via: "LINK" as const },
        }
      : { ids: { customerId: who.customerId }, data: { by: "CUSTOMER" as const } };

// Inside a caller's transaction (the confirm link marks its token used in the same one).
export const confirmIn = async (tx: Tx, who: Who, bookingId: string, now: Date) => {
  const { ids, data } = actor(who);
  const booking = await lockReservation(tx, who, bookingId, "CONFIRMED", now);
  await tx.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", expiresAt: null },
  });
  await bookHeldSlots(tx, booking.id);
  await tx.bookingEvent.create({
    data: { bookingId: booking.id, type: BOOKING_EVENTS.CONFIRMED, data, ...ids },
  });
};

// Returns the venue, for the top-up the caller runs once the transaction is done.
export const releaseIn = async (tx: Tx, who: Who, bookingId: string, now: Date) => {
  const { ids, data } = actor(who);
  const booking = await lockReservation(tx, who, bookingId, "RELEASED", now);
  await tx.booking.update({ where: { id: booking.id }, data: { status: "RELEASED" } });
  await releaseSlots(tx, [booking.id], now);
  await tx.bookingEvent.create({
    data: { bookingId: booking.id, type: BOOKING_EVENTS.RELEASED, data, ...ids },
  });
  return booking.venueId;
};

export const confirmReservation = async (
  who: Who,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction((tx) => confirmIn(tx, who, bookingId, now));
};

export const releaseReservation = async (
  who: Who,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  const venueId = await transaction((tx) => releaseIn(tx, who, bookingId, now));
  await topUpVenue(venueId, clock);
};
