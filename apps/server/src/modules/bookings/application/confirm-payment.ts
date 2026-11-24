import { bookHeldSlots } from "@/modules/venues";
import type { Tx } from "@/platform/db/transaction";
import { BOOKING_EVENTS } from "../domain/events";
import { openWaitingListing } from "./listings";

// A booking's online payment succeeded (the payments module calls this inside its own transaction).
// A compare-and-set from HELD, before its payment window ends: a booking past expiresAt is expired
// even if the sweeper hasn't reached it yet, so a payment that lands late confirms nothing. Returns
// whether it confirmed the booking; a late payment is the payments module's to refund (Phase 5).
export const confirmPaidBooking = async (
  tx: Tx,
  bookingId: string,
  paymentId: string,
  now: Date,
): Promise<boolean> => {
  const { count } = await tx.booking.updateMany({
    where: { id: bookingId, status: "HELD", expiresAt: { gt: now } },
    data: { status: "CONFIRMED", expiresAt: null },
  });
  if (count === 0) return false;
  await bookHeldSlots(tx, bookingId);
  await openWaitingListing(tx, bookingId);
  await tx.bookingEvent.create({
    data: { bookingId, type: BOOKING_EVENTS.CONFIRMED, data: { paymentId } },
  });
  return true;
};
