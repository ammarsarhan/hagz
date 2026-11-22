import { releaseSlots } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction } from "@/platform/db/transaction";
import { BOOKING_EVENTS } from "../domain/events";

// The expiry sweep (PR 4.2): PENDING bookings staff didn't approve and HELD ones nobody paid for,
// past their expiresAt, become EXPIRED and give their slots back. Runs every minute from the worker,
// and reads only Postgres (the [status, expiresAt] index), so nothing is lost if Redis is: the next
// run catches up. Rows are claimed with SKIP LOCKED, so two workers never take the same booking, and
// a booking a payment or approval is changing right now is left for the next run, which re-checks
// it. Anything acting on a booking checks expiresAt itself, so the minute's lag is never seen.

const BATCH = 200;

export const expireDueBookings = async (clock: Clock = systemClock): Promise<number> => {
  let expired = 0;
  for (;;) {
    const now = clock.now();
    const count = await transaction(async (tx) => {
      const due = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM "Booking"
        WHERE status IN ('PENDING', 'HELD') AND "expiresAt" <= ${now}
        ORDER BY "expiresAt"
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED`;
      if (due.length === 0) return 0;
      const ids = due.map((booking) => booking.id);
      // The rows are locked, so their status can't have moved since they were read.
      await tx.booking.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } });
      await releaseSlots(tx, ids, now);
      await tx.bookingEvent.createMany({
        data: due.map((booking) => ({
          bookingId: booking.id,
          type: BOOKING_EVENTS.EXPIRED,
          data: { from: booking.status },
        })),
      });
      return due.length;
    });
    expired += count;
    if (count < BATCH) return expired;
  }
};
