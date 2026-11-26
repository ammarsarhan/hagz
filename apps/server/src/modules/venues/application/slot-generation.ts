import type { QueueName } from "@hagz/contracts";
import type { Queue } from "bullmq";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { createQueue } from "@/platform/jobs/queues";
import { logger } from "@/platform/logger/logger";
import { fromStoredHours, GONE_GROUNDS } from "../domain/grounds";
import { desiredSlots, generationWindow, type DesiredSlot } from "../domain/slots";

// Slot generation (PR 2.6). Each run reconciles one whole ground: it works out the slots the ground
// should have from scratch (desiredSlots), compares them with the table, and in one transaction
// deletes free generated ones no longer scheduled, re-prices or re-versions free generated ones
// that differ, adds the missing ones, and moves generatedUntil. It never patches "what changed".
// Only AVAILABLE slots that staff haven't set (isManual) are touched: held, booked, blocked and
// staff-set slots stay as they are, even if the hour is no longer scheduled (the dashboard flags
// those). A lock on the ground's settings row means two runs for one ground never overlap, and an
// edit (which bumps scheduleVersion on that row) waits for a run in progress.
//
// Grounds of venues taking bookings (LIVE, or paused as MAINTENANCE, whose bookings stand) have
// slots; a draft, a ground that's gone, or a venue that's left has none, so a run for one clears its
// free generated slots.

export const GENERATION_QUEUE: QueueName = "slot-generation";

export interface GenerateJob {
  groundId: string;
}

let queue: Queue<GenerateJob> | undefined;
export const generationQueue = () => (queue ??= createQueue<GenerateJob>(GENERATION_QUEUE));
// On shutdown. The next generationQueue() opens a new one.
export const closeGenerationQueue = async () => {
  const open = queue;
  queue = undefined;
  await open?.close();
};

// Queues a run for each ground, after the change that needs it has committed (no outbox: a lost
// enqueue is caught by the stale-slot check within minutes). `tag` makes the job id: a fresh one
// for each edit, so an edit during a run gets its own run after it; the same one for the nightly
// roll-forward or a check, so those never pile up. BullMQ refuses ":" in ids.
export const enqueueGeneration = async (groundIds: string[], tag = String(Date.now())) => {
  if (groundIds.length === 0) return;
  try {
    await generationQueue().addBulk(
      groundIds.map((groundId) => ({
        name: "generate",
        data: { groundId },
        opts: {
          jobId: `generate-${groundId}-${tag}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      })),
    );
  } catch (error) {
    // The change itself is saved; the stale-slot check queues the run again.
    logger.error({ err: error, groundIds }, "couldn't queue slot generation");
  }
};

// The grounds of a venue that have (or should lose) slots, to queue after a venue-wide change.
export const venueGroundIds = async (venueId: string) =>
  (await prisma.ground.findMany({ where: { venueId }, select: { id: true } })).map((g) => g.id);

const TAKING_BOOKINGS = ["LIVE", "MAINTENANCE"] as const;

interface GroundForGeneration {
  venueId: string;
  timezone: string;
  scheduleVersion: number;
  eligible: boolean;
  desired: DesiredSlot[];
}

// What a ground should have now: its desired slots, or none when it shouldn't have any.
export const groundForGeneration = async (
  db: Tx | typeof prisma,
  groundId: string,
  now: Date,
): Promise<GroundForGeneration | null> => {
  const ground = await db.ground.findUnique({
    where: { id: groundId },
    select: {
      venueId: true,
      status: true,
      basePrice: true,
      peakPrice: true,
      discountPrice: true,
      settings: { select: { scheduleVersion: true } },
      schedules: { select: { dayOfWeek: true, hours: true } },
      venue: { select: { status: true, marketplace: { select: { timezone: true } } } },
    },
  });
  if (!ground) return null;
  const eligible =
    !(GONE_GROUNDS as readonly string[]).includes(ground.status) &&
    (TAKING_BOOKINGS as readonly string[]).includes(ground.venue.status);
  const timezone = ground.venue.marketplace.timezone;
  const desired = eligible
    ? desiredSlots({
        schedule: ground.schedules.map((day) => fromStoredHours(day.dayOfWeek, day.hours)),
        prices: ground,
        timezone,
        ...generationWindow(now),
      })
    : [];
  return {
    venueId: ground.venueId,
    timezone,
    scheduleVersion: ground.settings?.scheduleVersion ?? 0,
    eligible,
    desired,
  };
};

export interface GenerationResult {
  created: number;
  updated: number;
  deleted: number;
}

export const reconcileGround = async (
  groundId: string,
  clock: Clock = systemClock,
): Promise<GenerationResult | null> =>
  transaction(async (tx) => {
    // One run per ground at a time; an edit's version bump waits for this one.
    const locked = await tx.$queryRaw<{ groundId: string }[]>`
      SELECT "groundId" FROM "GroundSettings" WHERE "groundId" = ${groundId}::uuid FOR UPDATE`;
    if (locked.length === 0) return null;

    const now = clock.now();
    const ground = await groundForGeneration(tx, groundId, now);
    if (!ground) return null;
    const { to } = generationWindow(now);
    const { desired, scheduleVersion: version } = ground;
    const starts = desired.map((slot) => slot.startsAt);
    const tiers = desired.map((slot) => slot.tier);
    const prices = desired.map((slot) => slot.price);

    // First, free generated slots from now on that are no longer scheduled, so an hour they leave
    // (say, a reset occasion slot's) is clear for the scheduled slots added below.
    const deleted = await tx.$executeRaw`
      DELETE FROM "GroundSlot"
      WHERE "groundId" = ${groundId}::uuid AND "startsAt" >= ${now}
        AND "status" = 'AVAILABLE' AND NOT "isManual"
        AND NOT ("startsAt" = ANY(${starts}::timestamptz[]))`;

    // Free generated slots whose tier, price or version differ.
    const updated = await tx.$executeRaw`
      UPDATE "GroundSlot" AS g
      SET "tier" = d.t::"PriceTier", "price" = d.p, "scheduleVersion" = ${version},
          "updatedAt" = now()
      FROM unnest(${starts}::timestamptz[], ${tiers}::text[], ${prices}::int[]) AS d(s, t, p)
      WHERE g."groundId" = ${groundId}::uuid AND g."startsAt" = d.s
        AND g."status" = 'AVAILABLE' AND NOT g."isManual"
        AND (g."tier" <> d.t::"PriceTier" OR g."price" <> d.p OR g."scheduleVersion" <> ${version})`;

    // Missing slots. An hour already taken by another slot (held, booked, blocked or staff-set)
    // keeps that one.
    const created = await tx.$executeRaw`
      INSERT INTO "GroundSlot"
        ("id", "groundId", "venueId", "startsAt", "endsAt", "tier", "price", "scheduleVersion",
         "updatedAt")
      SELECT uuidv7(), ${groundId}::uuid, ${ground.venueId}::uuid, d.s, d.s + interval '1 hour',
             d.t::"PriceTier", d.p, ${version}, now()
      FROM unnest(${starts}::timestamptz[], ${tiers}::text[], ${prices}::int[]) AS d(s, t, p)
      ON CONFLICT DO NOTHING`;

    await tx.groundSettings.update({
      where: { groundId },
      data: { generatedUntil: ground.eligible ? to : null, generatedAt: now },
    });
    return { created, updated, deleted };
  });

// Past free slots are of no use (bookings keep the history), so the nightly run deletes them and
// the table stays near its 90-day size.
export const purgePastSlots = async (clock: Clock = systemClock) =>
  prisma.groundSlot.deleteMany({
    where: { status: "AVAILABLE", endsAt: { lte: clock.now() } },
  });
