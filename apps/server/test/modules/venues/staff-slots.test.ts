import { randomUUID } from "node:crypto";
import { ChangedSlots, VenueSlots, type StaffPermissions } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { generationQueue, reconcileGround } from "@/modules/venues/application/slot-generation";
import { driftOf } from "@/modules/venues/application/slot-monitoring";
import { NO_PERMISSIONS } from "@/modules/venues/domain/permissions";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { addMember, createMarketplace, createStaff, createVenue } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// Staff changing a venue's slots (PR 2.6): blocking, pricing by hand, adding slots for an occasion,
// and resetting to the schedule, with generation leaving their changes be.

const HOUR = 3_600_000;

const call = async (staffId: string, method: string, path: string, body?: unknown) =>
  router.request(`/v1/staff${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${await signJwt({ sub: staffId, sid: randomUUID() }, { audience: "staff", ttlSeconds: 600 })}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const problem = async (res: Response) => {
  const body = (await res.json()) as Record<string, unknown>;
  delete body.requestId;
  return body;
};

const only = (granted: Partial<StaffPermissions>): StaffPermissions => ({
  ...NO_PERMISSIONS,
  ...granted,
});

let phones = 0;
const phone = () => `+2010055${String(phones++).padStart(5, "0")}`;

// A live venue whose ground is open 7 to 10 pm every day, generated.
const aLiveGround = async () => {
  const marketplace = await createMarketplace();
  const venue = await createVenue(marketplace.id);
  const owner = await createStaff({ phone: phone() });
  await addMember(venue.id, owner.id, { role: "OWNER" });
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
      schedules: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          hours: { "19": "DISCOUNT", "20": "PEAK", "21": "BASE" },
        })),
      },
    },
  });
  await reconcileGround(ground.id);
  const slots = await prisma.groundSlot.findMany({
    where: { groundId: ground.id },
    orderBy: { startsAt: "asc" },
  });
  return { owner, venueId: venue.id, groundId: ground.id, path: `/venues/${venue.id}`, slots };
};

const slot = (id: string) => prisma.groundSlot.findUniqueOrThrow({ where: { id } });
const queued = async () =>
  (await generationQueue().getJobs(["waiting"])).map((job) => job.data.groundId);

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("reading a day", () => {
  it("shows staff who can view the schedule a day of the venue's slots", async () => {
    const { venueId, path, slots } = await aLiveGround();
    const viewer = await createStaff({ phone: phone() });
    await addMember(venueId, viewer.id, { permissions: only({ schedule: "view" }) });
    const res = await call(viewer.id, "GET", `${path}/slots`);
    expect(res.status).toBe(200);
    const day = VenueSlots.parse(await res.json());
    expect(day.slots.map((s) => s.id)).toEqual(slots.slice(0, 3).map((s) => s.id));
    // How long a booking there may run, for picking a stretch of them.
    expect(day.grounds[0]).toMatchObject({ minimumSlots: 1, maximumSlots: 3 });

    const outsider = await createStaff({ phone: phone() });
    await addMember(venueId, outsider.id, { permissions: NO_PERMISSIONS });
    expect((await call(outsider.id, "GET", `${path}/slots`)).status).toBe(403);
  });
});

describe("blocking", () => {
  it("closes free slots, which generation then leaves be", async () => {
    const { owner, path, groundId, slots } = await aLiveGround();
    const [a, b] = slots;
    const res = await call(owner.id, "POST", `${path}/slots/block`, { slotIds: [a?.id, b?.id] });
    expect(res.status).toBe(200);
    expect(ChangedSlots.parse(await res.json()).slots.map((s) => s.status)).toEqual([
      "BLOCKED",
      "BLOCKED",
    ]);
    expect(
      await prisma.venueEvent.count({ where: { type: "SLOTS_BLOCKED", staffId: owner.id } }),
    ).toBe(1);

    await reconcileGround(groundId);
    expect((await slot(a?.id ?? "")).status).toBe("BLOCKED");
  });

  it("refuses slots that aren't free, all or nothing", async () => {
    const { owner, path, slots } = await aLiveGround();
    const [a, b] = slots;
    await call(owner.id, "POST", `${path}/slots/block`, { slotIds: [a?.id] });
    const res = await call(owner.id, "POST", `${path}/slots/block`, { slotIds: [a?.id, b?.id] });
    expect(res.status).toBe(409);
    expect(await problem(res)).toMatchObject({ code: "SLOT_UNAVAILABLE", slotIds: [a?.id] });
    expect((await slot(b?.id ?? "")).status).toBe("AVAILABLE");
  });

  it("refuses another venue's slots, and ones that started", async () => {
    const { owner, path, venueId, groundId } = await aLiveGround();
    const other = await aLiveGround();
    const res = await call(owner.id, "POST", `${path}/slots/block`, {
      slotIds: [other.slots[0]?.id],
    });
    expect(res.status).toBe(404);
    expect(await problem(res)).toMatchObject({
      code: "SLOT_NOT_FOUND",
      slotIds: [other.slots[0]?.id],
    });

    const started = await prisma.groundSlot.create({
      data: {
        groundId,
        venueId,
        startsAt: new Date(Date.now() - 10 * 60_000),
        endsAt: new Date(Date.now() + 50 * 60_000),
        tier: "BASE",
        price: 60000,
        scheduleVersion: 1,
      },
    });
    const late = await call(owner.id, "POST", `${path}/slots/block`, { slotIds: [started.id] });
    expect(late.status).toBe(422);
    expect(await problem(late)).toMatchObject({ code: "SLOT_STARTED" });
  });

  it("is for staff who manage the schedule", async () => {
    const { venueId, path, slots } = await aLiveGround();
    const viewer = await createStaff({ phone: phone() });
    await addMember(venueId, viewer.id, { permissions: only({ schedule: "view" }) });
    const res = await call(viewer.id, "POST", `${path}/slots/block`, { slotIds: [slots[0]?.id] });
    expect(res.status).toBe(403);
  });
});

describe("unblocking", () => {
  it("opens blocked slots again and has generation look them over", async () => {
    const { owner, path, groundId, slots } = await aLiveGround();
    const [a, b] = slots;
    await call(owner.id, "POST", `${path}/slots/block`, { slotIds: [a?.id] });
    const free = await call(owner.id, "POST", `${path}/slots/unblock`, { slotIds: [b?.id] });
    expect(free.status).toBe(409);

    await generationQueue().drain();
    const res = await call(owner.id, "POST", `${path}/slots/unblock`, { slotIds: [a?.id] });
    expect(res.status).toBe(200);
    expect((await slot(a?.id ?? "")).status).toBe("AVAILABLE");
    expect(await queued()).toEqual([groundId]);
  });
});

describe("pricing by hand", () => {
  it("keeps the price through schedule changes until reset", async () => {
    const { owner, path, groundId, slots } = await aLiveGround();
    const peak = slots.find((s) => s.tier === "PEAK");
    const res = await call(owner.id, "PUT", `${path}/slots/price`, {
      slotIds: [peak?.id],
      price: 90000,
    });
    expect(res.status).toBe(200);
    expect(ChangedSlots.parse(await res.json()).slots[0]).toMatchObject({
      price: 90000,
      isManual: true,
    });

    // The owner raises the peak price: every peak slot follows but this one.
    await prisma.ground.update({ where: { id: groundId }, data: { peakPrice: 80000 } });
    await prisma.groundSettings.update({ where: { groundId }, data: { scheduleVersion: 2 } });
    await reconcileGround(groundId);
    expect((await slot(peak?.id ?? "")).price).toBe(90000);
    expect(await driftOf(groundId, new Date())).toEqual({ missing: 0, extra: 0, wrong: 0 });

    await generationQueue().drain();
    const reset = await call(owner.id, "POST", `${path}/slots/reset`, { slotIds: [peak?.id] });
    expect(reset.status).toBe(200);
    expect(await queued()).toEqual([groundId]);
    await reconcileGround(groundId);
    expect(await slot(peak?.id ?? "")).toMatchObject({ price: 80000, isManual: false });
  });
});

describe("adding slots for an occasion", () => {
  // A match night: 7:30 to 9 pm on the first day, across the 7 and 8 pm hours.
  const matchNight = (slots: { startsAt: Date }[]) => {
    const seven = slots[0]?.startsAt.getTime() ?? 0;
    return {
      startsAt: new Date(seven + 0.5 * HOUR).toISOString(),
      endsAt: new Date(seven + 2 * HOUR).toISOString(),
      price: 120000,
    };
  };

  it("adds them in place of the free schedule slots they overlap, which stay away", async () => {
    const { owner, path, groundId, slots } = await aLiveGround();
    const res = await call(owner.id, "POST", `${path}/slots`, {
      groundId,
      slots: [matchNight(slots)],
    });
    expect(res.status).toBe(200);
    const [added] = ChangedSlots.parse(await res.json()).slots;
    expect(added).toMatchObject({
      tier: "BASE",
      price: 120000,
      isManual: true,
      status: "AVAILABLE",
    });
    // 7 and 8 pm made way; 9 pm is still there.
    expect(await prisma.groundSlot.findUnique({ where: { id: slots[0]?.id ?? "" } })).toBeNull();
    expect(await prisma.groundSlot.findUnique({ where: { id: slots[1]?.id ?? "" } })).toBeNull();
    expect(
      await prisma.groundSlot.findUnique({ where: { id: slots[2]?.id ?? "" } }),
    ).not.toBeNull();

    // Generation doesn't put them back, and the audit sees nothing wrong.
    await reconcileGround(groundId);
    const evening = await prisma.groundSlot.findMany({
      where: { groundId, startsAt: { lte: slots[2]?.startsAt } },
      orderBy: { startsAt: "asc" },
    });
    expect(evening.map((s) => s.id)).toEqual([added?.id, slots[2]?.id]);
    expect(await driftOf(groundId, new Date())).toEqual({ missing: 0, extra: 0, wrong: 0 });

    // Reset, it goes, and the schedule's hours come back.
    await call(owner.id, "POST", `${path}/slots/reset`, { slotIds: [added?.id] });
    await reconcileGround(groundId);
    expect(await prisma.groundSlot.findUnique({ where: { id: added?.id ?? "" } })).toBeNull();
    const back = await prisma.groundSlot.findMany({
      where: { groundId, startsAt: { lte: slots[2]?.startsAt } },
      orderBy: { startsAt: "asc" },
    });
    expect(back.map((s) => s.startsAt)).toEqual(slots.slice(0, 3).map((s) => s.startsAt));
  });

  it("refuses to overlap a slot someone holds or staff set", async () => {
    const { owner, path, groundId, slots } = await aLiveGround();
    await call(owner.id, "POST", `${path}/slots/block`, { slotIds: [slots[1]?.id] });
    const res = await call(owner.id, "POST", `${path}/slots`, {
      groundId,
      slots: [matchNight(slots)],
    });
    expect(res.status).toBe(409);
    expect(await problem(res)).toMatchObject({ code: "SLOT_OVERLAPS" });
    // All or nothing: the free 7 pm slot is still there.
    expect(
      await prisma.groundSlot.findUnique({ where: { id: slots[0]?.id ?? "" } }),
    ).not.toBeNull();
  });

  it("checks each slot's times", async () => {
    const { owner, path, groundId, slots } = await aLiveGround();
    const seven = slots[0]?.startsAt.getTime() ?? 0;
    const at = (from: number, to: number) => ({
      startsAt: new Date(from).toISOString(),
      endsAt: new Date(to).toISOString(),
      price: 1000,
    });
    const cases = [
      [at(Date.now() - HOUR, Date.now()), "It has to start in the future."],
      [at(Date.now() + 91 * 24 * HOUR, Date.now() + 91 * 24 * HOUR + HOUR), "up to 90 days"],
      [at(seven, seven + 5 * HOUR), "30 minutes to 4 hours"],
      [at(seven + 10 * 60_000, seven + 70 * 60_000), "quarter hour"],
    ] as const;
    for (const [body, message] of cases) {
      const res = await call(owner.id, "POST", `${path}/slots`, { groundId, slots: [body] });
      expect(res.status).toBe(422);
      const details = await problem(res);
      expect(details).toMatchObject({ code: "INVALID_SLOT", index: 0 });
      expect(String(details.detail)).toContain(message);
    }
    const overlapping = await call(owner.id, "POST", `${path}/slots`, {
      groundId,
      slots: [at(seven, seven + HOUR), at(seven + 0.5 * HOUR, seven + 1.5 * HOUR)],
    });
    expect(await problem(overlapping)).toMatchObject({ code: "INVALID_SLOT", index: 1 });
  });

  it("is for the venue's own grounds", async () => {
    const { owner, path, slots } = await aLiveGround();
    const other = await aLiveGround();
    const res = await call(owner.id, "POST", `${path}/slots`, {
      groundId: other.groundId,
      slots: [matchNight(slots)],
    });
    expect(res.status).toBe(404);
  });
});
