import { VenueSearchResults } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { reconcileGround } from "@/modules/venues/application/slot-generation";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createMarketplace } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// Search, first slice (PR 3.3): where, when, sport and size, ordering and pages.

const MAADI = { latitude: 29.96, longitude: 31.25 };
const DOKKI = { latitude: 30.04, longitude: 31.21 };

// Tomorrow in Cairo, so the venues' notice and the time of day never get in the way.
const tomorrow = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + 24 * 3_600_000),
  );

const search = async (params: Record<string, string | number>, language = "en") => {
  const all: Record<string, string | number> = { marketplace: "EG", date: tomorrow(), ...params };
  const query = new URLSearchParams(
    Object.entries(all).map(([key, value]): [string, string] => [key, `${value}`]),
  );
  return router.request(`/v1/venues?${query.toString()}`, {
    headers: { "Accept-Language": language },
  });
};

const found = async (params: Record<string, string | number>) => {
  const res = await search(params);
  expect(res.status).toBe(200);
  return VenueSearchResults.parse(await res.json());
};

// Open every hour, base before 8 pm and peak from it.
const allDay = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  hours: Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => [String(hour), hour >= 20 ? "PEAK" : "BASE"]),
  ),
}));

let places = 0;
const place = async (marketplaceId: string, parentId: string | null, en: string, ar: string) =>
  prisma.location.create({
    data: {
      marketplaceId,
      parentId,
      locality: parentId ? "DISTRICT" : "GOVERNORATE",
      slug: `place-${++places}`,
      translations: {
        create: [
          { language: "EN", name: en },
          { language: "AR", name: ar },
        ],
      },
    },
  });

let slugs = 0;
const venue = async ({
  marketplaceId,
  locationId,
  name,
  arabic,
  at,
  sport = "FOOTBALL",
  size = "FIVE_A_SIDE",
  status = "LIVE",
  rating = null,
}: {
  marketplaceId: string;
  locationId: string;
  name: string;
  arabic: string;
  at: { latitude: number; longitude: number };
  sport?: "FOOTBALL" | "PADEL";
  size?: "FIVE_A_SIDE" | "STANDARD";
  status?: "LIVE" | "MAINTENANCE" | "DRAFT";
  rating?: string | null;
}) => {
  const created = await prisma.venue.create({
    data: {
      marketplaceId,
      locationId,
      slug: `search-${++slugs}`,
      status,
      averageRating: rating,
      reviewCount: rating ? 10 : 0,
      translations: {
        create: [
          { language: "EN", name },
          { language: "AR", name: arabic },
        ],
      },
      settings: { create: { defaultPermissions: {}, minimumNotice: 60 } },
    },
  });
  await prisma.$executeRaw`
    UPDATE "Venue" SET coordinates = ST_SetSRID(ST_MakePoint(${at.longitude}, ${at.latitude}), 4326)::geography
    WHERE id = ${created.id}::uuid`;
  const ground = await prisma.ground.create({
    data: {
      venueId: created.id,
      sport,
      size,
      surface: "ARTIFICIAL_TURF",
      environment: "OUTDOOR",
      position: 0,
      basePrice: 60000,
      peakPrice: 75000,
      settings: { create: { scheduleVersion: 1 } },
      schedules: { create: allDay },
    },
  });
  await reconcileGround(ground.id);
  return { ...created, groundId: ground.id };
};

// The slot starting at a local time tomorrow on a ground.
const slotAt = async (groundId: string, time: string) => {
  const [row] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT s.id FROM "GroundSlot" s
    WHERE s."groundId" = ${groundId}::uuid
      AND s."startsAt" = ((${tomorrow()}::date + ${time}::time)::timestamp AT TIME ZONE 'Africa/Cairo')`;
  if (!row) throw new Error(`No slot at ${time}.`);
  return row.id;
};

const setup = async () => {
  const marketplace = await createMarketplace({ code: "EG" });
  const cairo = await place(marketplace.id, null, "Cairo", "القاهرة");
  const maadi = await place(marketplace.id, cairo.id, "Maadi", "المعادي");
  const giza = await place(marketplace.id, null, "Giza", "الجيزة");
  const dokki = await place(marketplace.id, giza.id, "Dokki", "الدقي");
  const nile = await venue({
    marketplaceId: marketplace.id,
    locationId: maadi.id,
    name: "Nile Kickoff",
    arabic: "نايل كيك أوف",
    at: MAADI,
    rating: "4.60",
  });
  const padel = await venue({
    marketplaceId: marketplace.id,
    locationId: dokki.id,
    name: "Wadi Padel",
    arabic: "وادي بادل",
    at: DOKKI,
    sport: "PADEL",
    size: "STANDARD",
  });
  // Neither of these is ever found: one isn't live yet, one is paused.
  await venue({
    marketplaceId: marketplace.id,
    locationId: maadi.id,
    name: "Nile Draft",
    arabic: "مسودة",
    at: MAADI,
    status: "DRAFT",
  });
  await venue({
    marketplaceId: marketplace.id,
    locationId: maadi.id,
    name: "Nile Paused",
    arabic: "متوقف",
    at: MAADI,
    status: "MAINTENANCE",
  });
  return { cairo, maadi, nile, padel };
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("where", () => {
  it("finds live venues anywhere under an area", async () => {
    const { cairo, maadi, nile } = await setup();
    for (const area of [cairo.id, maadi.id]) {
      const page = await found({ area });
      expect(page.data.map((card) => card.id)).toEqual([nile.id]);
    }
    expect(page0(await found({ area: cairo.id }))).toMatchObject({
      name: "Nile Kickoff",
      area: "Maadi, Cairo",
      sports: ["FOOTBALL"],
      rating: { average: 4.6, count: 10 },
      distance: null,
    });
  });

  it("finds venues near a point, nearest first, within the radius", async () => {
    const { nile, padel } = await setup();
    const close = await found({ ...MAADI, radius: 3 });
    expect(close.data.map((card) => card.id)).toEqual([nile.id]);
    expect(close.data[0]?.distance).toBe(0);

    const wide = await found({ ...MAADI, radius: 20 });
    expect(wide.data.map((card) => card.id)).toEqual([nile.id, padel.id]);
    expect(wide.data[1]?.distance).toBeGreaterThan(8000);
  });

  it("finds a venue by part of its name, in either language", async () => {
    const { nile } = await setup();
    expect((await found({ q: "kick" })).data.map((card) => card.id)).toEqual([nile.id]);
    expect((await found({ q: "نايل" })).data.map((card) => card.id)).toEqual([nile.id]);
    expect((await found({ q: "nothing like it" })).data).toEqual([]);
  });

  it("answers 404 for a marketplace that isn't open", async () => {
    await setup();
    const res = await search({ marketplace: "ZZ" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "MARKETPLACE_NOT_FOUND" });
  });
});

describe("when", () => {
  it("needs a ground free for the whole length from the start asked for", async () => {
    const { nile } = await setup();
    // 9 pm taken: 8 pm for two hours isn't free all through, 10 pm is.
    await prisma.groundSlot.update({
      where: { id: await slotAt(nile.groundId, "21:00") },
      data: { status: "BLOCKED" },
    });
    expect((await found({ q: "nile", start: "20:00", hours: 2 })).data).toEqual([]);

    const late = await found({ q: "nile", start: "22:00", hours: 1 });
    const card = page0(late);
    expect(card.nextTimes[0]).toEqual({
      startsAt: new Date(`${tomorrow()}T22:00:00+02:00`).toISOString(),
      grounds: 1,
    });
    expect(card.priceFrom).toBe(75000);
  });

  it("shows the next free times through the day, and the cheapest hour among them", async () => {
    await setup();
    const card = page0(await found({ q: "nile", hours: 2 }));
    expect(card.nextTimes).toHaveLength(4);
    // Midnight to 2 am, at the base price.
    expect(card.nextTimes[0]?.startsAt).toBe(
      new Date(`${tomorrow()}T00:00:00+02:00`).toISOString(),
    );
    expect(card.priceFrom).toBe(60000);
  });

  it("leaves out grounds under maintenance", async () => {
    const { nile } = await setup();
    await prisma.ground.update({ where: { id: nile.groundId }, data: { status: "MAINTENANCE" } });
    expect((await found({ q: "nile" })).data).toEqual([]);
  });
});

describe("filters and order", () => {
  it("finds by sport and size", async () => {
    const { nile, padel } = await setup();
    expect((await found({ sport: "PADEL" })).data.map((card) => card.id)).toEqual([padel.id]);
    expect((await found({ size: "FIVE_A_SIDE" })).data.map((card) => card.id)).toEqual([nile.id]);
  });

  it("puts the best rated first without a point, the unrated last", async () => {
    const { nile, padel } = await setup();
    expect((await found({})).data.map((card) => card.id)).toEqual([nile.id, padel.id]);
  });

  it("pages with a cursor, and refuses one that's been tampered with", async () => {
    const { nile, padel } = await setup();
    const first = await found({ limit: 1 });
    expect(first.data.map((card) => card.id)).toEqual([nile.id]);
    expect(first.nextCursor).not.toBeNull();
    expect(first.total).toBe(2);
    const second = await found({ limit: 1, cursor: first.nextCursor ?? "" });
    expect(second.data.map((card) => card.id)).toEqual([padel.id]);
    expect(second.nextCursor).toBeNull();

    const res = await search({ cursor: "not-a-cursor" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "INVALID_CURSOR" });
  });

  it("refuses sorting by distance without a point", async () => {
    await setup();
    expect((await search({ sort: "DISTANCE" })).status).toBe(400);
  });
});

function page0(page: VenueSearchResults) {
  const card = page.data[0];
  if (!card) throw new Error("No venue found.");
  return card;
}
