import { randomUUID } from "node:crypto";
import {
  Ground,
  VenueSetup,
  WeekSchedule,
  list,
  type CreateGround,
  type CreateVenue,
  type StaffPermissions,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { NO_PERMISSIONS } from "@/modules/venues/domain/permissions";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { addMember, createMarketplace, createStaff } from "../../support/factories";
import { resetRedis } from "../../support/redis";

const call = async (staffId: string, method: string, path: string, body?: unknown) =>
  router.request(`/v1/staff${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "Accept-Language": "en",
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
const aDraft = async () => {
  const marketplace = await createMarketplace();
  const area = await prisma.location.create({
    data: { marketplaceId: marketplace.id, locality: "DISTRICT", slug: `maadi-${phones}` },
  });
  const owner = await createStaff({
    phone: `+2010055${String(phones++).padStart(5, "0")}`,
    language: "EN",
  });
  const body: CreateVenue = {
    name: "Champions Arena",
    coordinates: { latitude: 29.96, longitude: 31.25 },
    locationId: area.id,
  };
  const created = VenueSetup.parse(await (await call(owner.id, "POST", "/venues", body)).json());
  return { owner, venueId: created.venue.id, path: `/venues/${created.venue.id}` };
};

const PITCH: CreateGround = {
  name: "Pitch 1",
  sport: "FOOTBALL",
  size: "FIVE_A_SIDE",
  surface: "ARTIFICIAL_TURF",
  environment: "OUTDOOR",
  basePrice: 60000,
  peakPrice: 80000,
  discountPrice: null,
  minimumSlots: 1,
  maximumSlots: 3,
};

const addGround = async (owner: string, path: string, overrides: Partial<CreateGround> = {}) => {
  const res = await call(owner, "POST", `${path}/grounds`, { ...PITCH, ...overrides });
  expect(res.status).toBe(201);
  return Ground.parse(await res.json());
};

const versionOf = async (groundId: string) =>
  (await prisma.groundSettings.findUniqueOrThrow({ where: { groundId } })).scheduleVersion;

const THURSDAY_EVENING = {
  days: [
    {
      dayOfWeek: 4,
      hours: [
        { hour: 18, tier: "BASE" },
        { hour: 19, tier: "PEAK" },
        { hour: 20, tier: "PEAK" },
      ],
    },
  ],
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("adding grounds", () => {
  it("adds them in order, named in the owner's language", async () => {
    const { owner, path, venueId } = await aDraft();
    const first = await addGround(owner.id, path);
    const second = await addGround(owner.id, path, { name: "Pitch 2", size: "SEVEN_A_SIDE" });
    expect(first).toMatchObject({
      name: "Pitch 1",
      status: "ACTIVE",
      position: 0,
      minimumSlots: 1,
      maximumSlots: 3,
      openHours: 0,
    });
    expect(second.position).toBe(1);

    const translations = await prisma.groundTranslation.findMany({ where: { groundId: first.id } });
    expect(translations).toEqual([expect.objectContaining({ language: "EN", name: "Pitch 1" })]);
    expect(await prisma.venueEvent.count({ where: { venueId, type: "GROUND_ADDED" } })).toBe(2);
  });

  it("keep sizes to the sport and bookings in order", async () => {
    const { owner, path } = await aDraft();
    for (const body of [
      { ...PITCH, sport: "PADEL" },
      { ...PITCH, minimumSlots: 4, maximumSlots: 2 },
      { ...PITCH, basePrice: 0 },
    ]) {
      expect((await call(owner.id, "POST", `${path}/grounds`, body)).status).toBe(400);
    }
    const padel = await addGround(owner.id, path, { sport: "PADEL", size: "STANDARD" });
    expect(padel.sport).toBe("PADEL");
  });

  it("are for members who manage the schedule", async () => {
    const { owner, path, venueId } = await aDraft();
    const listingEditor = await createStaff({ phone: "+201009990000" });
    await addMember(venueId, listingEditor.id, { permissions: only({ venue: "manage" }) });
    const res = await call(listingEditor.id, "POST", `${path}/grounds`, PITCH);
    expect(res.status).toBe(403);
    expect(await problem(res)).toMatchObject({ area: "schedule" });
    expect((await call(owner.id, "POST", `${path}/grounds`, PITCH)).status).toBe(201);
  });
});

describe("changing grounds", () => {
  it("re-shapes the slots when a price or booking length changes", async () => {
    const { owner, path } = await aDraft();
    const ground = await addGround(owner.id, path);
    const before = await versionOf(ground.id);

    await call(owner.id, "PATCH", `${path}/grounds/${ground.id}`, { surface: "NATURAL_GRASS" });
    expect(await versionOf(ground.id)).toBe(before);

    const res = await call(owner.id, "PATCH", `${path}/grounds/${ground.id}`, { basePrice: 65000 });
    expect(Ground.parse(await res.json()).basePrice).toBe(65000);
    expect(await versionOf(ground.id)).toBe(before + 1);
  });

  it("renames in the owner's language", async () => {
    const { owner, path } = await aDraft();
    const ground = await addGround(owner.id, path);
    const res = await call(owner.id, "PATCH", `${path}/grounds/${ground.id}`, { name: "Main" });
    expect(Ground.parse(await res.json()).name).toBe("Main");
  });

  it("won't drop the peak price while hours are peak", async () => {
    const { owner, path } = await aDraft();
    const ground = await addGround(owner.id, path);
    await call(owner.id, "PUT", `${path}/grounds/${ground.id}/schedule`, THURSDAY_EVENING);
    const res = await call(owner.id, "PATCH", `${path}/grounds/${ground.id}`, { peakPrice: null });
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({ code: "INVALID_GROUND", field: "peakPrice" });
  });

  it("reorders them", async () => {
    const { owner, path } = await aDraft();
    const [a, b] = [await addGround(owner.id, path), await addGround(owner.id, path)];
    const res = await call(owner.id, "PUT", `${path}/grounds/order`, { groundIds: [b.id, a.id] });
    const { data } = list(Ground).parse(await res.json());
    expect(data.map((g) => g.id)).toEqual([b.id, a.id]);
    expect(
      (await call(owner.id, "PUT", `${path}/grounds/order`, { groundIds: [a.id] })).status,
    ).toBe(422);
  });
});

describe("a live venue keeps an active ground", () => {
  const live = async () => {
    const draft = await aDraft();
    const grounds = [
      await addGround(draft.owner.id, draft.path),
      await addGround(draft.owner.id, draft.path),
    ];
    await prisma.venue.update({ where: { id: draft.venueId }, data: { status: "LIVE" } });
    return { ...draft, grounds };
  };

  it("lets all but the last be paused or removed", async () => {
    const { owner, path, grounds } = await live();
    const [a, b] = grounds as [Ground, Ground];
    const paused = await call(owner.id, "PATCH", `${path}/grounds/${a.id}`, {
      status: "MAINTENANCE",
    });
    expect(Ground.parse(await paused.json()).status).toBe("MAINTENANCE");

    for (const res of [
      await call(owner.id, "PATCH", `${path}/grounds/${b.id}`, { status: "MAINTENANCE" }),
      await call(owner.id, "DELETE", `${path}/grounds/${b.id}`),
    ]) {
      expect(res.status).toBe(409);
      expect(await problem(res)).toMatchObject({ code: "LAST_ACTIVE_GROUND" });
    }
    // The paused one can go: it wasn't active.
    expect((await call(owner.id, "DELETE", `${path}/grounds/${a.id}`)).status).toBe(204);
  });

  it("holds when two people pause the last two at once", async () => {
    const { owner, path, grounds } = await live();
    const statuses = await Promise.all(
      grounds.map(async (g) => {
        const res = await call(owner.id, "PATCH", `${path}/grounds/${g.id}`, {
          status: "MAINTENANCE",
        });
        return res.status;
      }),
    );
    expect(statuses.sort()).toEqual([200, 409]);
  });

  it("doesn't apply before the venue is live", async () => {
    const { owner, path } = await aDraft();
    const only = await addGround(owner.id, path);
    expect((await call(owner.id, "DELETE", `${path}/grounds/${only.id}`)).status).toBe(204);
  });
});

describe("removing a ground", () => {
  it("keeps it for history, off the venue and its layout", async () => {
    const { owner, path, venueId } = await aDraft();
    const ground = await addGround(owner.id, path);
    await prisma.venueLayout.create({
      data: {
        venueId,
        columns: 16,
        rows: 19,
        items: {
          create: { type: "GROUND", groundId: ground.id, x: 0, y: 0, orientation: "HORIZONTAL" },
        },
      },
    });
    expect((await call(owner.id, "DELETE", `${path}/grounds/${ground.id}`)).status).toBe(204);

    expect((await prisma.ground.findUniqueOrThrow({ where: { id: ground.id } })).status).toBe(
      "DELETED",
    );
    expect(await prisma.venueLayoutItem.count()).toBe(0);
    const { data } = list(Ground).parse(
      await (await call(owner.id, "GET", `${path}/grounds`)).json(),
    );
    expect(data).toEqual([]);
    expect((await call(owner.id, "DELETE", `${path}/grounds/${ground.id}`)).status).toBe(404);
  });
});

describe("the layout when a ground's footprint changes", () => {
  const placed = async (columns: number, rows: number) => {
    const { owner, path, venueId } = await aDraft();
    const ground = await addGround(owner.id, path);
    await prisma.venueLayout.create({
      data: {
        venueId,
        columns,
        rows,
        items: {
          create: { type: "GROUND", groundId: ground.id, x: 0, y: 0, orientation: "HORIZONTAL" },
        },
      },
    });
    return { owner, path, ground };
  };

  it("keeps the ground where it is if it still fits", async () => {
    const { owner, path, ground } = await placed(16, 19);
    await call(owner.id, "PATCH", `${path}/grounds/${ground.id}`, { size: "SEVEN_A_SIDE" });
    expect(await prisma.venueLayoutItem.count({ where: { groundId: ground.id } })).toBe(1);
  });

  it("takes it off the layout when it no longer fits", async () => {
    const { owner, path, ground } = await placed(6, 4);
    await call(owner.id, "PATCH", `${path}/grounds/${ground.id}`, { size: "ELEVEN_A_SIDE" });
    expect(await prisma.venueLayoutItem.count({ where: { groundId: ground.id } })).toBe(0);
  });
});

describe("weekly hours", () => {
  it("are set as a week, read back, and re-shape the slots", async () => {
    const { owner, path } = await aDraft();
    const ground = await addGround(owner.id, path);
    const before = await versionOf(ground.id);
    const res = await call(
      owner.id,
      "PUT",
      `${path}/grounds/${ground.id}/schedule`,
      THURSDAY_EVENING,
    );
    expect(WeekSchedule.parse(await res.json())).toEqual(THURSDAY_EVENING);
    const read = await call(owner.id, "GET", `${path}/grounds/${ground.id}/schedule`);
    expect(WeekSchedule.parse(await read.json())).toEqual(THURSDAY_EVENING);
    expect(await versionOf(ground.id)).toBe(before + 1);

    const { data } = list(Ground).parse(
      await (await call(owner.id, "GET", `${path}/grounds`)).json(),
    );
    expect(data[0]?.openHours).toBe(3);
  });

  it("need the price for each tier they use", async () => {
    const { owner, path } = await aDraft();
    const ground = await addGround(owner.id, path, { peakPrice: null });
    const res = await call(
      owner.id,
      "PUT",
      `${path}/grounds/${ground.id}/schedule`,
      THURSDAY_EVENING,
    );
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({ code: "SCHEDULE_TIER_WITHOUT_PRICE", tier: "PEAK" });
  });

  it("copy to other grounds, which keep their own prices", async () => {
    const { owner, path } = await aDraft();
    const [source, target] = [
      await addGround(owner.id, path),
      await addGround(owner.id, path, { name: "Pitch 2", basePrice: 70000, peakPrice: 90000 }),
    ];
    await call(owner.id, "PUT", `${path}/grounds/${source.id}/schedule`, THURSDAY_EVENING);
    const res = await call(owner.id, "POST", `${path}/grounds/${source.id}/schedule/copy`, {
      groundIds: [target.id],
    });
    expect(res.status).toBe(204);
    const copied = await call(owner.id, "GET", `${path}/grounds/${target.id}/schedule`);
    expect(WeekSchedule.parse(await copied.json())).toEqual(THURSDAY_EVENING);
    const kept = await call(owner.id, "GET", `${path}/grounds`);
    const prices = list(Ground)
      .parse(await kept.json())
      .data.map((g) => g.basePrice);
    expect(prices).toEqual([60000, 70000]);
  });

  it("won't copy peak hours to a ground without a peak price, saying which", async () => {
    const { owner, path } = await aDraft();
    const [source, target] = [
      await addGround(owner.id, path),
      await addGround(owner.id, path, { name: "Pitch 2", peakPrice: null }),
    ];
    await call(owner.id, "PUT", `${path}/grounds/${source.id}/schedule`, THURSDAY_EVENING);
    const res = await call(owner.id, "POST", `${path}/grounds/${source.id}/schedule/copy`, {
      groundIds: [target.id],
    });
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({
      code: "SCHEDULE_TIER_WITHOUT_PRICE",
      groundId: target.id,
    });
  });
});

it("can't change grounds while the venue is in review", async () => {
  const { owner, path, venueId } = await aDraft();
  const ground = await addGround(owner.id, path);
  await prisma.venue.update({ where: { id: venueId }, data: { status: "SUBMITTED" } });
  for (const [method, url, body] of [
    ["POST", `${path}/grounds`, PITCH],
    ["PATCH", `${path}/grounds/${ground.id}`, { basePrice: 1 }],
    ["PUT", `${path}/grounds/${ground.id}/schedule`, THURSDAY_EVENING],
    ["DELETE", `${path}/grounds/${ground.id}`, undefined],
  ] as const) {
    expect((await call(owner.id, method, url, body)).status).toBe(409);
  }
});
