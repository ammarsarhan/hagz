import type { PriceTier } from "@/generated/prisma/enums";
import type { Tx } from "@/platform/db/transaction";

// Venues owns GroundSlot, so bookings claim and give back slots through these, inside the booking's
// own transaction (docs/architecture.md, "No double bookings").

export interface FreeSlot {
  id: string;
  startsAt: Date;
  endsAt: Date;
  tier: PriceTier;
  price: number;
}

// Locks the free slots starting inside [from, to) on a ground, in startsAt order so overlapping
// requests can't deadlock. Concurrent claims queue on the row locks; when the first commits, Postgres
// re-checks each waiting row, finds it no longer AVAILABLE and drops it, so the others see a gap.
export const lockFreeSlots = (tx: Tx, groundId: string, from: Date, to: Date) =>
  tx.$queryRaw<FreeSlot[]>`
    SELECT id, "startsAt", "endsAt", tier, price FROM "GroundSlot"
    WHERE "groundId" = ${groundId}::uuid AND "startsAt" >= ${from} AND "startsAt" < ${to}
      AND status = 'AVAILABLE'
    ORDER BY "startsAt"
    FOR UPDATE`;

// Gives locked slots to a booking: HELD while it waits for approval or payment, BOOKED once
// confirmed. Throws if any slot moved since it was locked, which would be a bug.
export const assignSlots = async (
  tx: Tx,
  slotIds: readonly string[],
  bookingId: string,
  status: "HELD" | "BOOKED",
) => {
  const { count } = await tx.groundSlot.updateMany({
    where: { id: { in: [...slotIds] }, status: "AVAILABLE" },
    data: { status, bookingId },
  });
  if (count !== slotIds.length) throw new Error("Locked slots changed before they were assigned.");
};

// A held booking was confirmed (approved and paid, or paid): its slots become BOOKED.
export const bookHeldSlots = (tx: Tx, bookingId: string) =>
  tx.groundSlot.updateMany({ where: { bookingId, status: "HELD" }, data: { status: "BOOKED" } });

// Bookings that ended without being played (expired, cancelled, released) give their slots back.
// freedAt lets search mark a slot "just freed" near kick-off (docs/regulars.md).
export const releaseSlots = (tx: Tx, bookingIds: readonly string[], now: Date) =>
  tx.groundSlot.updateMany({
    where: { bookingId: { in: [...bookingIds] } },
    data: { status: "AVAILABLE", bookingId: null, freedAt: now },
  });
