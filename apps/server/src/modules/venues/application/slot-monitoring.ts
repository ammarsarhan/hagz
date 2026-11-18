import { notifyAdmins, type SlotProblem } from "@/modules/notifications";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { email } from "@/platform/email/email";
import { webLinks } from "@/platform/http/links";
import { logger } from "@/platform/logger/logger";
import { queueConnection } from "@/platform/redis/connections";
import { HORIZON_DAYS } from "../domain/slots";
import { enqueueGeneration, groundForGeneration, purgePastSlots } from "./slot-generation";

// Keeping slot generation honest (PR 2.6). Checks every few minutes find grounds whose slots are
// stale, short of the horizon or missing; the nightly audit compares every ground's slots with what
// desiredSlots says; the nightly roll-forward moves every ground on a day and clears past free
// slots. Anything wrong queues the ground's generation and alerts the admins, in the admin web and
// by email, at most one open (unread) alert per problem per ground.

// An edit's run normally lands in seconds; slots still stale after this are a failure.
const STALE_AFTER_MINUTES = 5;

export interface SlotIssue {
  groundId: string;
  venueId: string;
  problem: SlotProblem;
  detail: string;
}

// Grounds that should have slots: not removed, at a venue taking bookings.
const eligibleGrounds = () =>
  prisma.ground.findMany({
    where: { status: { not: "DELETED" }, venue: { status: { in: ["LIVE", "MAINTENANCE"] } } },
    select: { id: true, venueId: true },
  });

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? "" : "s"}`;

// ---------- The checks ----------

export const checkSlots = async (clock: Clock = systemClock): Promise<SlotIssue[]> => {
  const now = clock.now();
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000);
  // Generated to within a day of the horizon: the nightly roll-forward keeps it there.
  const behindBefore = new Date(now.getTime() + (HORIZON_DAYS - 1) * 24 * 3_600_000);

  const stale = await prisma.$queryRaw<{ groundId: string; venueId: string; count: number }[]>`
    SELECT s."groundId", s."venueId", count(*)::int AS count
    FROM "GroundSlot" s
    JOIN "GroundSettings" gs ON gs."groundId" = s."groundId"
    WHERE s."status" = 'AVAILABLE' AND NOT s."isManual" AND s."startsAt" >= ${now}
      AND s."scheduleVersion" < gs."scheduleVersion" AND gs."updatedAt" < ${staleBefore}
    GROUP BY s."groundId", s."venueId"`;

  // Grounds with weekly hours at a venue taking bookings, how far they're generated, and whether
  // they have any slots ahead.
  const scheduled = await prisma.$queryRaw<
    { groundId: string; venueId: string; generatedUntil: Date | null; ahead: boolean }[]
  >`
    SELECT g.id AS "groundId", g."venueId", gs."generatedUntil",
           EXISTS (SELECT 1 FROM "GroundSlot" s WHERE s."groundId" = g.id AND s."startsAt" >= ${now})
             AS ahead
    FROM "Ground" g
    JOIN "Venue" v ON v.id = g."venueId"
    JOIN "GroundSettings" gs ON gs."groundId" = g.id
    WHERE g."status" <> 'DELETED' AND v."status" IN ('LIVE', 'MAINTENANCE')
      AND EXISTS (SELECT 1 FROM "GroundSchedule" sc WHERE sc."groundId" = g.id)
      AND gs."updatedAt" < ${staleBefore}`;

  const issues: SlotIssue[] = stale.map(({ groundId, venueId, count }) => ({
    groundId,
    venueId,
    problem: "STALE",
    detail: `${plural(count, "free slot")} still from an older schedule, ${String(STALE_AFTER_MINUTES)}+ minutes after the change.`,
  }));
  for (const { groundId, venueId, generatedUntil, ahead } of scheduled) {
    if (!ahead) {
      issues.push({
        groundId,
        venueId,
        problem: "EMPTY",
        detail: "It has weekly hours but no slots ahead.",
      });
    } else if (!generatedUntil || generatedUntil < behindBefore) {
      issues.push({
        groundId,
        venueId,
        problem: "BEHIND",
        detail: generatedUntil
          ? `Its slots run out on ${generatedUntil.toISOString().slice(0, 10)}, short of ${String(HORIZON_DAYS)} days.`
          : "Its slots have never been generated to the horizon.",
      });
    }
  }
  return issues;
};

// ---------- The audit ----------

export interface Drift {
  // Scheduled hours with no slot, free generated slots no longer scheduled, and free generated slots
  // with the wrong tier or price.
  missing: number;
  extra: number;
  wrong: number;
}

// A ground's free generated slots ahead against what desiredSlots says. Staff-set, held, booked and
// blocked slots are left out, as generation leaves them alone.
export const driftOf = async (groundId: string, now: Date): Promise<Drift> => {
  const ground = await groundForGeneration(prisma, groundId, now);
  if (!ground) return { missing: 0, extra: 0, wrong: 0 };
  const slots = await prisma.groundSlot.findMany({
    where: { groundId, endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    select: {
      startsAt: true,
      endsAt: true,
      tier: true,
      price: true,
      status: true,
      isManual: true,
    },
  });
  const byStart = new Map(slots.map((slot) => [slot.startsAt.getTime(), slot]));
  const wanted = new Set(ground.desired.map((slot) => slot.startsAt.getTime()));
  // Whether any slot overlaps an hour: one staff added for an occasion (10:30–12:00) covers the
  // scheduled hours it sits across, which generation then leaves out. Both lists are in order, so
  // one pass finds them.
  let next = 0;
  const covered = (start: number, end: number) => {
    while (next < slots.length && (slots[next]?.endsAt.getTime() ?? 0) <= start) next += 1;
    return next < slots.length && (slots[next]?.startsAt.getTime() ?? Infinity) < end;
  };
  let missing = 0;
  let wrong = 0;
  for (const slot of ground.desired) {
    const existing = byStart.get(slot.startsAt.getTime());
    if (!existing) {
      if (!covered(slot.startsAt.getTime(), slot.endsAt.getTime())) missing += 1;
    } else if (
      existing.status === "AVAILABLE" &&
      !existing.isManual &&
      (existing.tier !== slot.tier || existing.price !== slot.price)
    ) {
      wrong += 1;
    }
  }
  const extra = slots.filter(
    (slot) =>
      slot.startsAt >= now &&
      slot.status === "AVAILABLE" &&
      !slot.isManual &&
      !wanted.has(slot.startsAt.getTime()),
  ).length;
  return { missing, extra, wrong };
};

// Every ground that should have slots, nightly.
export const auditSlots = async (clock: Clock = systemClock): Promise<SlotIssue[]> => {
  const now = clock.now();
  const issues: SlotIssue[] = [];
  for (const { id: groundId, venueId } of await eligibleGrounds()) {
    const { missing, extra, wrong } = await driftOf(groundId, now);
    if (missing + wrong + extra > 0) {
      const parts = [
        missing > 0 ? `${plural(missing, "slot")} missing` : null,
        extra > 0 ? `${plural(extra, "slot")} not on the schedule` : null,
        wrong > 0 ? `${plural(wrong, "slot")} with the wrong tier or price` : null,
      ].filter(Boolean);
      issues.push({ groundId, venueId, problem: "DRIFT", detail: `${parts.join(", ")}.` });
    }
  }
  return issues;
};

// ---------- Alerts ----------

// Tells every active admin about each issue that isn't already open for that ground. In-app first
// (the record of it), then by email, which outside development may not be set up yet: a failed
// email is logged and the in-app alert stands.
export const raiseAlerts = async (issues: SlotIssue[]) => {
  if (issues.length === 0) return 0;
  const admins = await prisma.admin.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true },
  });
  let raised = 0;
  for (const issue of issues) {
    const open = await prisma.notification.count({
      where: {
        type: "SLOT_GENERATION_ALERT",
        readAt: null,
        adminId: { not: null },
        AND: [
          { data: { path: ["groundId"], equals: issue.groundId } },
          { data: { path: ["problem"], equals: issue.problem } },
        ],
      },
    });
    if (open > 0) continue;
    raised += 1;
    await prisma.$transaction((tx) =>
      notifyAdmins(
        tx,
        admins.map((admin) => ({
          adminId: admin.id,
          venueId: issue.venueId,
          type: "SLOT_GENERATION_ALERT" as const,
          data: { groundId: issue.groundId, problem: issue.problem, detail: issue.detail },
        })),
      ),
    );
    logger.warn(issue, "slot generation alert");

    const names = await prisma.ground.findUnique({
      where: { id: issue.groundId },
      select: {
        translations: { select: { language: true, name: true } },
        venue: { select: { translations: { select: { language: true, name: true } } } },
      },
    });
    const nameIn = (rows: { language: string; name: string }[] | undefined, fallback: string) =>
      rows?.find((row) => row.language === "EN")?.name ?? rows?.[0]?.name ?? fallback;
    if (!webLinks) continue;
    for (const admin of admins) {
      await email
        .sendSlotGenerationAlert({
          to: admin.email,
          name: admin.name,
          venueName: nameIn(names?.venue.translations, "A venue"),
          groundName: nameIn(names?.translations, "a ground"),
          problem: issue.detail,
          slotsUrl: webLinks.adminVenueSlots(issue.venueId),
        })
        .catch((error: unknown) => {
          logger.error({ err: error, to: admin.email }, "couldn't email a slot generation alert");
        });
    }
  }
  return raised;
};

// ---------- What the jobs run ----------

// When the nightly runs last finished, for the admin's Jobs card.
const LAST_RUN = (name: "roll-forward" | "audit" | "checks") => `slots:last-run:${name}`;
const recordRun = (name: "roll-forward" | "audit" | "checks", clock: Clock) =>
  queueConnection.set(LAST_RUN(name), clock.now().toISOString());
export const lastRuns = async () => {
  const [rollForward, audit, checks] = await queueConnection.mget(
    LAST_RUN("roll-forward"),
    LAST_RUN("audit"),
    LAST_RUN("checks"),
  );
  return { rollForward: rollForward ?? null, audit: audit ?? null, checks: checks ?? null };
};

// A bucket of minutes, so the same check or audit queues a ground once however often it fires.
const bucket = (clock: Clock, minutes: number) =>
  String(Math.floor(clock.now().getTime() / (minutes * 60_000)));

export const runChecks = async (clock: Clock = systemClock) => {
  const issues = await checkSlots(clock);
  await enqueueGeneration(
    [...new Set(issues.map((issue) => issue.groundId))],
    `check-${bucket(clock, STALE_AFTER_MINUTES)}`,
  );
  const raised = await raiseAlerts(issues);
  await recordRun("checks", clock);
  return { issues: issues.length, raised };
};

export const runAudit = async (clock: Clock = systemClock) => {
  const issues = await auditSlots(clock);
  await enqueueGeneration(
    issues.map((issue) => issue.groundId),
    `audit-${bucket(clock, 24 * 60)}`,
  );
  const raised = await raiseAlerts(issues);
  await recordRun("audit", clock);
  return { issues: issues.length, raised };
};

export const rollForward = async (clock: Clock = systemClock) => {
  const purged = await purgePastSlots(clock);
  const grounds = await eligibleGrounds();
  await enqueueGeneration(
    grounds.map((ground) => ground.id),
    `nightly-${bucket(clock, 24 * 60)}`,
  );
  await recordRun("roll-forward", clock);
  return { purged: purged.count, queued: grounds.length };
};

// A run that failed on its last attempt.
export const alertFailedRun = async (groundId: string, reason: string) => {
  const ground = await prisma.ground.findUnique({
    where: { id: groundId },
    select: { venueId: true },
  });
  if (!ground) return;
  await raiseAlerts([
    {
      groundId,
      venueId: ground.venueId,
      problem: "FAILED",
      detail: `Generating its slots failed after every retry: ${reason}`,
    },
  ]);
};
