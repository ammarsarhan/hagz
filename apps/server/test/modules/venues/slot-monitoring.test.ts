import { beforeEach, describe, expect, it } from "vitest";
import { generationQueue, reconcileGround } from "@/modules/venues/application/slot-generation";
import {
  auditSlots,
  checkSlots,
  lastRuns,
  raiseAlerts,
  rollForward,
  runChecks,
} from "@/modules/venues/application/slot-monitoring";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { mailbox } from "../../support/email";
import { createAdmin, createMarketplace, createVenue } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// Keeping slot generation honest (PR 2.6): the checks, the nightly audit and roll-forward, and the
// alerts they raise.

const HOUR = 3_600_000;

const aGround = async (venueStatus: "LIVE" | "DRAFT" = "LIVE") => {
  const marketplace = await createMarketplace();
  const venue = await createVenue(marketplace.id);
  if (venueStatus !== "LIVE") {
    await prisma.venue.update({ where: { id: venue.id }, data: { status: venueStatus } });
  }
  const ground = await prisma.ground.create({
    data: {
      venueId: venue.id,
      sport: "FOOTBALL",
      size: "FIVE_A_SIDE",
      surface: "ARTIFICIAL_TURF",
      environment: "OUTDOOR",
      position: 0,
      basePrice: 60000,
      peakPrice: 75000,
      translations: { create: { language: "EN", name: "Pitch 1" } },
      settings: { create: { scheduleVersion: 1 } },
      schedules: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          hours: { "19": "BASE", "20": "PEAK" },
        })),
      },
    },
  });
  await prisma.venueTranslation.create({
    data: { venueId: venue.id, language: "EN", name: "Arena", description: "", address: "" },
  });
  return { venueId: venue.id, groundId: ground.id };
};

// The edit happened long enough ago for its run to have landed.
const settledEdit = (groundId: string) =>
  prisma.$executeRaw`
    UPDATE "GroundSettings" SET "updatedAt" = now() - interval '10 minutes'
    WHERE "groundId" = ${groundId}::uuid`;

const queued = async () =>
  (await generationQueue().getJobs(["waiting", "delayed"])).map((job) => job.data.groundId);

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  mailbox.alerts.length = 0;
});

describe("checkSlots", () => {
  it("finds nothing wrong with a ground generated to the horizon", async () => {
    const { groundId } = await aGround();
    await reconcileGround(groundId);
    await settledEdit(groundId);
    expect(await checkSlots()).toEqual([]);
  });

  it("finds free slots still from an older schedule minutes after the edit", async () => {
    const { groundId, venueId } = await aGround();
    await reconcileGround(groundId);
    await prisma.groundSettings.update({ where: { groundId }, data: { scheduleVersion: 2 } });
    // Within the grace period, a run is presumably on its way.
    expect(await checkSlots()).toEqual([]);
    await settledEdit(groundId);
    const [issue, ...more] = await checkSlots();
    expect(more).toEqual([]);
    expect(issue).toMatchObject({ groundId, venueId, problem: "STALE" });
    expect(issue?.detail).toContain("older schedule");
  });

  it("finds a live ground with weekly hours and no slots ahead", async () => {
    const { groundId, venueId } = await aGround();
    await settledEdit(groundId);
    expect(await checkSlots()).toEqual([
      { groundId, venueId, problem: "EMPTY", detail: "It has weekly hours but no slots ahead." },
    ]);
  });

  it("finds a ground generated short of the horizon", async () => {
    const { groundId, venueId } = await aGround();
    await reconcileGround(groundId);
    await prisma.groundSettings.update({
      where: { groundId },
      data: { generatedUntil: new Date(Date.now() + 30 * 24 * HOUR) },
    });
    await settledEdit(groundId);
    const [issue, ...more] = await checkSlots();
    expect(more).toEqual([]);
    expect(issue).toMatchObject({ groundId, venueId, problem: "BEHIND" });
    expect(issue?.detail).toContain("short of 90 days");
  });

  it("leaves a draft's grounds alone: they have no slots yet", async () => {
    const { groundId } = await aGround("DRAFT");
    await settledEdit(groundId);
    expect(await checkSlots()).toEqual([]);
  });
});

describe("auditSlots", () => {
  it("finds no drift right after a run", async () => {
    const { groundId } = await aGround();
    await reconcileGround(groundId);
    expect(await auditSlots()).toEqual([]);
  });

  it("finds missing, extra and wrongly priced slots, but not ones staff set or hold", async () => {
    const { groundId, venueId } = await aGround();
    await reconcileGround(groundId);
    const [a, b, c, d, e] = await prisma.groundSlot.findMany({
      where: { groundId },
      orderBy: { startsAt: "asc" },
    });
    await prisma.groundSlot.delete({ where: { id: a?.id } });
    await prisma.groundSlot.update({ where: { id: b?.id }, data: { price: 1 } });
    // Staff-set and blocked slots are theirs to differ.
    await prisma.groundSlot.update({ where: { id: c?.id }, data: { price: 1, isManual: true } });
    await prisma.groundSlot.update({ where: { id: d?.id }, data: { price: 1, status: "BLOCKED" } });
    // An hour that isn't scheduled: 3 am the day of the last slot.
    await prisma.groundSlot.create({
      data: {
        groundId,
        venueId,
        startsAt: new Date((e?.startsAt.getTime() ?? 0) + 7 * HOUR),
        endsAt: new Date((e?.startsAt.getTime() ?? 0) + 8 * HOUR),
        tier: "BASE",
        price: 60000,
        scheduleVersion: 1,
      },
    });

    expect(await auditSlots()).toEqual([
      {
        groundId,
        venueId,
        problem: "DRIFT",
        detail: "1 slot missing, 1 slot not on the schedule, 1 slot with the wrong tier or price.",
      },
    ]);
  });
});

describe("raiseAlerts", () => {
  it("tells every active admin in the app and by email, once while it's open", async () => {
    await createAdmin();
    const { groundId, venueId } = await aGround();
    const issue = { groundId, venueId, problem: "EMPTY" as const, detail: "No slots ahead." };

    expect(await raiseAlerts([issue])).toBe(1);
    const alerts = await prisma.notification.findMany({
      where: { type: "SLOT_GENERATION_ALERT" },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      venueId,
      data: { groundId, problem: "EMPTY", detail: "No slots ahead." },
      readAt: null,
    });
    expect(mailbox.alerts).toHaveLength(1);
    expect(mailbox.alerts[0]).toMatchObject({
      venueName: "Arena",
      groundName: "Pitch 1",
      problem: "No slots ahead.",
    });
    expect(mailbox.alerts[0]?.slotsUrl).toMatch(new RegExp(`/admin/venues/${venueId}/slots$`));

    // Still unread: no second alert. Another problem, or the same once read, is a new one.
    expect(await raiseAlerts([issue])).toBe(0);
    expect(await raiseAlerts([{ ...issue, problem: "DRIFT" }])).toBe(1);
    await prisma.notification.updateMany({ data: { readAt: new Date() } });
    expect(await raiseAlerts([issue])).toBe(1);
  });
});

describe("the jobs", () => {
  it("checks queue the ground's generation and remember when they ran", async () => {
    await createAdmin();
    const { groundId } = await aGround();
    await settledEdit(groundId);
    expect(await runChecks()).toEqual({ issues: 1, raised: 1 });
    expect(await queued()).toEqual([groundId]);
    // Firing again in the same window queues nothing more.
    await runChecks();
    expect(await queued()).toEqual([groundId]);
    expect((await lastRuns()).checks).not.toBeNull();
  });

  it("the roll-forward clears past free slots and queues every ground taking bookings", async () => {
    const { groundId, venueId } = await aGround();
    const draft = await aGround("DRAFT");
    await prisma.groundSlot.create({
      data: {
        groundId,
        venueId,
        startsAt: new Date(Date.now() - 3 * HOUR),
        endsAt: new Date(Date.now() - 2 * HOUR),
        tier: "BASE",
        price: 60000,
        scheduleVersion: 1,
      },
    });
    expect(await rollForward()).toEqual({ purged: 1, queued: 1 });
    expect(await queued()).toEqual([groundId]);
    expect(await queued()).not.toContain(draft.groundId);
    expect((await lastRuns()).rollForward).not.toBeNull();
  });
});
