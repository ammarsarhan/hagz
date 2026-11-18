import { beforeEach, describe, expect, it } from "vitest";
import {
  groundForGeneration,
  purgePastSlots,
  reconcileGround,
} from "@/modules/venues/application/slot-generation";
import { HORIZON_DAYS } from "@/modules/venues/domain/slots";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createMarketplace, createVenue } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// Reconciling a ground's slots with its schedule (PR 2.6): the table ends up as desiredSlots says,
// whatever it held before, and only free generated slots are ever touched.

const HOUR = 3_600_000;
// Every day: 7 pm base, 8 pm peak, 9 pm discount.
const EVERY_DAY = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  hours: { "19": "BASE", "20": "PEAK", "21": "DISCOUNT" },
}));

const aGround = async (venueStatus: "DRAFT" | "LIVE" | "MAINTENANCE" = "LIVE") => {
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
      discountPrice: 45000,
      settings: { create: { scheduleVersion: 1 } },
      schedules: { create: EVERY_DAY },
    },
  });
  return { venueId: venue.id, groundId: ground.id };
};

const slotsOf = (groundId: string) =>
  prisma.groundSlot.findMany({ where: { groundId }, orderBy: { startsAt: "asc" } });

const desiredCount = async (groundId: string) =>
  (await groundForGeneration(prisma, groundId, new Date()))?.desired.length ?? 0;

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("reconcileGround", () => {
  it("fills a live venue's ground to the horizon with its schedule's slots", async () => {
    const { groundId } = await aGround();
    const result = await reconcileGround(groundId);

    const slots = await slotsOf(groundId);
    // Three hours a day for about 90 days.
    expect(slots.length).toBeGreaterThanOrEqual(3 * (HORIZON_DAYS - 1));
    expect(slots.length).toBe(await desiredCount(groundId));
    expect(result).toEqual({ created: slots.length, updated: 0, deleted: 0 });
    expect(new Set(slots.map((slot) => slot.tier))).toEqual(new Set(["BASE", "PEAK", "DISCOUNT"]));
    for (const slot of slots) {
      expect(slot).toMatchObject({ status: "AVAILABLE", isManual: false, scheduleVersion: 1 });
      expect(slot.price).toBe(
        { BASE: 60000, PEAK: 75000, DISCOUNT: 45000 }[slot.tier as "BASE" | "PEAK" | "DISCOUNT"],
      );
      expect(slot.endsAt.getTime() - slot.startsAt.getTime()).toBe(HOUR);
    }
    const settings = await prisma.groundSettings.findUniqueOrThrow({ where: { groundId } });
    expect(settings.generatedUntil?.getTime()).toBeGreaterThan(
      Date.now() + (HORIZON_DAYS * 24 - 2) * HOUR,
    );
  });

  it("changes nothing when run again", async () => {
    const { groundId } = await aGround();
    await reconcileGround(groundId);
    const before = await slotsOf(groundId);
    expect(await reconcileGround(groundId)).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(await slotsOf(groundId)).toEqual(before);
  });

  it("follows a schedule and price change, leaving held, booked, blocked and staff-set slots be", async () => {
    const { groundId } = await aGround();
    await reconcileGround(groundId);
    const peakBefore = (await slotsOf(groundId)).filter((slot) => slot.tier === "PEAK");
    const [blocked, manual] = peakBefore;
    await prisma.groundSlot.update({ where: { id: blocked?.id }, data: { status: "BLOCKED" } });
    await prisma.groundSlot.update({
      where: { id: manual?.id },
      data: { isManual: true, price: 99000 },
    });

    // Peak hours closed, base hours dearer: the owner's edit bumps the version.
    await prisma.groundSchedule.updateMany({
      where: { groundId },
      data: { hours: { "19": "BASE", "21": "DISCOUNT" } },
    });
    await prisma.ground.update({ where: { id: groundId }, data: { basePrice: 65000 } });
    await prisma.groundSettings.update({ where: { groundId }, data: { scheduleVersion: 2 } });
    const result = await reconcileGround(groundId);

    const slots = await slotsOf(groundId);
    const peak = slots.filter((slot) => slot.tier === "PEAK");
    // Only the blocked and the staff-set peak hours are left, as they were.
    expect(peak.map((slot) => slot.id).sort()).toEqual([blocked?.id, manual?.id].sort());
    expect(peak.find((slot) => slot.id === manual?.id)).toMatchObject({
      price: 99000,
      scheduleVersion: 1,
    });
    for (const slot of slots.filter((s) => s.tier === "BASE")) {
      expect(slot).toMatchObject({ price: 65000, scheduleVersion: 2 });
    }
    for (const slot of slots.filter((s) => s.tier === "DISCOUNT")) {
      expect(slot).toMatchObject({ price: 45000, scheduleVersion: 2 });
    }
    expect(result?.deleted).toBe(peakBefore.length - 2);
  });

  it("gives a draft venue's ground no slots", async () => {
    const { groundId } = await aGround("DRAFT");
    expect(await reconcileGround(groundId)).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(await slotsOf(groundId)).toEqual([]);
    const settings = await prisma.groundSettings.findUniqueOrThrow({ where: { groundId } });
    expect(settings.generatedUntil).toBeNull();
  });

  it("keeps a paused venue's slots: its bookings stand and it resumes as it was", async () => {
    const { groundId } = await aGround("MAINTENANCE");
    await reconcileGround(groundId);
    expect((await slotsOf(groundId)).length).toBe(await desiredCount(groundId));
  });

  it("clears a removed ground's free slots, keeping the ones someone holds", async () => {
    const { groundId } = await aGround();
    await reconcileGround(groundId);
    const [kept] = await slotsOf(groundId);
    await prisma.groundSlot.update({ where: { id: kept?.id }, data: { status: "BLOCKED" } });
    await prisma.ground.update({ where: { id: groundId }, data: { status: "DELETED" } });

    await reconcileGround(groundId);
    expect((await slotsOf(groundId)).map((slot) => slot.id)).toEqual([kept?.id]);
    const settings = await prisma.groundSettings.findUniqueOrThrow({ where: { groundId } });
    expect(settings.generatedUntil).toBeNull();
  });

  it("never touches slots that already started", async () => {
    const { groundId, venueId } = await aGround();
    const started = await prisma.groundSlot.create({
      data: {
        groundId,
        venueId,
        startsAt: new Date(Date.now() - 30 * 60_000),
        endsAt: new Date(Date.now() + 30 * 60_000),
        tier: "BASE",
        price: 1,
        scheduleVersion: 0,
      },
    });
    await reconcileGround(groundId);
    expect(await prisma.groundSlot.findUnique({ where: { id: started.id } })).toEqual(started);
  });

  it("gives the same table when two runs for a ground race", async () => {
    const { groundId } = await aGround();
    const results = await Promise.all([reconcileGround(groundId), reconcileGround(groundId)]);
    expect(results.map((r) => r?.created).sort()).toEqual([0, await desiredCount(groundId)]);
    expect((await slotsOf(groundId)).length).toBe(await desiredCount(groundId));
  });

  it("does nothing for a ground that isn't there", async () => {
    expect(await reconcileGround("0190f2a4-0000-7000-8000-000000000000")).toBeNull();
  });
});

describe("purgePastSlots", () => {
  it("deletes free slots that have ended, keeping blocked ones and the future", async () => {
    const { groundId, venueId } = await aGround();
    const slot = (hoursFromNow: number, status: "AVAILABLE" | "BLOCKED" = "AVAILABLE") =>
      prisma.groundSlot.create({
        data: {
          groundId,
          venueId,
          startsAt: new Date(Date.now() + hoursFromNow * HOUR),
          endsAt: new Date(Date.now() + (hoursFromNow + 1) * HOUR),
          tier: "BASE",
          price: 60000,
          scheduleVersion: 1,
          status,
        },
      });
    await slot(-3);
    const blocked = await slot(-2, "BLOCKED");
    const future = await slot(5);

    expect((await purgePastSlots()).count).toBe(1);
    expect((await slotsOf(groundId)).map((s) => s.id)).toEqual([blocked.id, future.id]);
  });
});
