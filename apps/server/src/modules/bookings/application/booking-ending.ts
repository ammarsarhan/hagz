import type { Booking } from "@hagz/contracts";
import { BOOKING_EVENTS } from "../domain/events";

// How a booking ended, for the player: who cancelled it (and whether that was a decline, with the
// reason given), or what ran out. Read from its Cancellation and its DECLINED / EXPIRED events;
// nothing extra is stored. Shared by the Bookings list and the booking itself.

export const ENDING_EVENTS = [BOOKING_EVENTS.DECLINED, BOOKING_EVENTS.EXPIRED];

// What to select: add `events` filtered to ENDING_EVENTS (or more) yourself.
export const endingSelect = {
  status: true,
  cancellation: { select: { initiator: true, reason: true } },
} as const;

export const endingOf = (booking: {
  status: string;
  cancellation: { initiator: "CUSTOMER" | "VENUE" | "ADMIN"; reason: string | null } | null;
  events: { type: string; data: unknown }[];
}): Pick<Booking, "cancelled" | "expiredFrom"> => {
  const eventOf = (type: string) => booking.events.find((event) => event.type === type);
  const from = (eventOf(BOOKING_EVENTS.EXPIRED)?.data as { from?: unknown } | null | undefined)
    ?.from;
  return {
    cancelled:
      booking.status === "CANCELLED" && booking.cancellation
        ? {
            by: booking.cancellation.initiator,
            declined: eventOf(BOOKING_EVENTS.DECLINED) !== undefined,
            reason: booking.cancellation.reason,
          }
        : null,
    expiredFrom:
      booking.status === "EXPIRED" && (from === "PENDING" || from === "HELD") ? from : null,
  };
};
