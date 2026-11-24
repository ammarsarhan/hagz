import { refreshCustomerCounters } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction } from "@/platform/db/transaction";
import { BOOKING_EVENTS } from "../domain/events";

// The completion sweep (PR 4.2, user 2026-11-22): a confirmed game that has ended is COMPLETED, by
// the system. Staff can still switch it to NO_SHOW (or back) until MARK_WINDOW_HOURS after the end;
// after that it's final. Runs every minute with the expiry sweep, on the [status, endsAt] index,
// claiming rows with SKIP LOCKED so a booking someone is changing right now waits for the next run.

const BATCH = 200;

export const completeEndedBookings = async (clock: Clock = systemClock): Promise<number> => {
  let completed = 0;
  for (;;) {
    const now = clock.now();
    const count = await transaction(async (tx) => {
      const due = await tx.$queryRaw<{ id: string; customerId: string }[]>`
        SELECT id, "customerId" FROM "Booking"
        WHERE status = 'CONFIRMED' AND "endsAt" <= ${now}
        ORDER BY "endsAt"
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED`;
      if (due.length === 0) return 0;
      const ids = due.map((booking) => booking.id);
      await tx.booking.updateMany({ where: { id: { in: ids } }, data: { status: "COMPLETED" } });
      await tx.bookingEvent.createMany({
        data: ids.map((bookingId) => ({
          bookingId,
          type: BOOKING_EVENTS.COMPLETED,
          data: { from: "CONFIRMED" },
        })),
      });
      await refreshCustomerCounters(
        tx,
        due.map((booking) => booking.customerId),
      );
      return due.length;
    });
    completed += count;
    if (count < BATCH) return completed;
  }
};
