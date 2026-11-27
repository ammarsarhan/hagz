import type { PriceTier } from "@/generated/prisma/enums";
import type { Tx } from "@/platform/db/transaction";
import { GONE_GROUNDS } from "../domain/grounds";
import { groundForGeneration } from "./slot-generation";

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
// freedAt lets search mark a slot "just freed" near kick-off (docs/regulars.md). On a ground being
// removed, nobody can book them again, so the ones still to come go instead of showing as free hours
// on the calendar until the ground is gone (user, 2026-11-27).
//
// A slot the booking kept through a schedule or price change is from the older schedule (its
// scheduleVersion is behind the ground's). Freed as it was, a closed hour would be on sale and an
// open one at the old price until the stale-slot check caught it, with a false alert. So each such
// hour is checked against the schedule now, here in the same transaction: still open, it takes
// today's tier and price; closed, it goes (user, 2026-11-27). Staff-set slots stay as they are.
export const releaseSlots = async (tx: Tx, bookingIds: readonly string[], now: Date) => {
  const ids = [...bookingIds];
  await tx.groundSlot.deleteMany({
    where: {
      bookingId: { in: ids },
      endsAt: { gt: now },
      ground: { status: { in: [...GONE_GROUNDS] } },
    },
  });
  const stale = await tx.$queryRaw<{ id: string; groundId: string; startsAt: Date }[]>`
    SELECT s.id, s."groundId", s."startsAt" FROM "GroundSlot" s
    JOIN "GroundSettings" gs ON gs."groundId" = s."groundId"
    WHERE s."bookingId" = ANY(${ids}::uuid[]) AND s."startsAt" >= ${now} AND NOT s."isManual"
      AND s."scheduleVersion" < gs."scheduleVersion"`;
  await tx.groundSlot.updateMany({
    where: { bookingId: { in: ids } },
    data: { status: "AVAILABLE", bookingId: null, freedAt: now },
  });
  await refreshStale(tx, stale, now);
};

const refreshStale = async (
  tx: Tx,
  stale: readonly { id: string; groundId: string; startsAt: Date }[],
  now: Date,
) => {
  const byGround = new Map<string, (typeof stale)[number][]>();
  for (const slot of stale)
    byGround.set(slot.groundId, [...(byGround.get(slot.groundId) ?? []), slot]);
  for (const [groundId, slots] of byGround) {
    const times = slots.map((slot) => slot.startsAt.getTime());
    const ground = await groundForGeneration(tx, groundId, now, {
      from: new Date(Math.min(...times)),
      to: new Date(Math.max(...times) + 1),
    });
    if (!ground) continue;
    const desired = new Map(ground.desired.map((slot) => [slot.startsAt.getTime(), slot]));
    const closed: string[] = [];
    for (const slot of slots) {
      const wanted = desired.get(slot.startsAt.getTime());
      if (!wanted) {
        closed.push(slot.id);
        continue;
      }
      await tx.groundSlot.update({
        where: { id: slot.id },
        data: { tier: wanted.tier, price: wanted.price, scheduleVersion: ground.scheduleVersion },
      });
    }
    if (closed.length > 0) await tx.groundSlot.deleteMany({ where: { id: { in: closed } } });
  }
};

export interface RangeSlot extends FreeSlot {
  status: "AVAILABLE" | "HELD" | "BOOKED" | "BLOCKED";
  bookingId: string | null;
}

// Locks every slot starting inside [from, to) on a ground, whatever its status, in startsAt order:
// a move may land on slots that are free, held for it, or already the moving booking's own, and the
// caller decides which of those it can take.
export const lockSlotsInRange = (tx: Tx, groundId: string, from: Date, to: Date) =>
  tx.$queryRaw<RangeSlot[]>`
    SELECT id, "startsAt", "endsAt", tier, price, status, "bookingId" FROM "GroundSlot"
    WHERE "groundId" = ${groundId}::uuid AND "startsAt" >= ${from} AND "startsAt" < ${to}
    ORDER BY "startsAt"
    FOR UPDATE`;

// Hands locked slots to another booking, whatever they held before (free, a hold, or the booking it
// replaces). The caller locked them and checked each one.
export const reassignSlots = async (
  tx: Tx,
  slotIds: readonly string[],
  bookingId: string,
  status: "HELD" | "BOOKED",
) => {
  const { count } = await tx.groundSlot.updateMany({
    where: { id: { in: [...slotIds] }, status: { not: "BLOCKED" } },
    data: { status, bookingId },
  });
  if (count !== slotIds.length)
    throw new Error("Locked slots changed before they were reassigned.");
};
