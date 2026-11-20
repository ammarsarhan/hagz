import { VenueFreeHours, VenueSearchResults } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { reconcileGround } from "@/modules/venues/application/slot-generation";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createMarketplace } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// Search (PR 3.3): where, when, the filters, ordering and pages.

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
      coordinates: { latitude: MAADI.latitude, longitude: MAADI.longitude },
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

describe("more filters", () => {
  const ids = async (params: Record<string, string | number>) =>
    (await found(params)).data.map((card) => card.id);

  it("finds by surface and setting, either of several", async () => {
    const { nile, padel } = await setup();
    await prisma.ground.update({
      where: { id: padel.groundId },
      data: { surface: "HARD_COURT", environment: "INDOOR" },
    });
    expect(await ids({ surface: "HARD_COURT" })).toEqual([padel.id]);
    expect(await ids({ setting: "OUTDOOR" })).toEqual([nile.id]);
    expect(await ids({ setting: "INDOOR,OUTDOOR" })).toEqual([nile.id, padel.id]);
    expect((await search({ surface: "LAVA" })).status).toBe(400);
  });

  it("finds venues with enough matching grounds", async () => {
    const { nile, padel } = await setup();
    await prisma.ground.create({
      data: {
        venueId: nile.id,
        sport: "FOOTBALL",
        size: "FIVE_A_SIDE",
        surface: "ARTIFICIAL_TURF",
        environment: "OUTDOOR",
        position: 1,
        basePrice: 60000,
        peakPrice: 75000,
      },
    });
    expect(await ids({ grounds: 2 })).toEqual([nile.id]);
    expect(await ids({ grounds: 1 })).toEqual([nile.id, padel.id]);
    // The ground filters count too: Wadi Padel's one ground isn't football.
    expect(await ids({ grounds: 1, sport: "FOOTBALL" })).toEqual([nile.id]);
  });

  it("finds by the price of a free time, per hour", async () => {
    const { nile, padel } = await setup();
    await prisma.groundSlot.updateMany({
      where: { groundId: padel.groundId },
      data: { price: 30000 },
    });
    expect(await ids({ priceMax: 40000 })).toEqual([padel.id]);
    expect(await ids({ priceMin: 50000 })).toEqual([nile.id]);
    // Per hour, so a two-hour game at 300 EGP an hour is still under 400.
    expect(await ids({ priceMax: 40000, hours: 2 })).toEqual([padel.id]);
  });

  it("finds venues with every amenity asked for", async () => {
    const { nile, padel } = await setup();
    const [parking, cafe] = await Promise.all(
      ["parking", "cafe"].map((key) =>
        prisma.amenityOption.create({
          data: { marketplaceId: nile.marketplaceId, key, icon: key },
        }),
      ),
    );
    if (!parking || !cafe) throw new Error("No amenities.");
    await prisma.venueAmenity.createMany({
      data: [
        { venueId: nile.id, optionId: parking.id, marketplaceId: nile.marketplaceId },
        { venueId: nile.id, optionId: cafe.id, marketplaceId: nile.marketplaceId },
        { venueId: padel.id, optionId: parking.id, marketplaceId: nile.marketplaceId },
      ],
    });
    expect(await ids({ amenities: parking.id })).toEqual([nile.id, padel.id]);
    expect(await ids({ amenities: `${parking.id},${cafe.id}` })).toEqual([nile.id]);
  });

  it("finds by rating and by how booking works", async () => {
    const { nile, padel } = await setup();
    expect(await ids({ rating: 4.5 })).toEqual([nile.id]);
    await prisma.venueSettings.update({
      where: { venueId: nile.id },
      data: {
        autoConfirm: false,
        paymentMode: "PLATFORM",
        cancellationPolicy: "STRICT",
        loyaltyStamps: 5,
        loyaltyWindow: 60,
      },
    });
    await prisma.venueSettings.update({
      where: { venueId: padel.id },
      data: {
        cancellationPolicy: "CUSTOM",
        cancellationTiers: [{ hours: 12, refundPercent: 100 }],
      },
    });
    expect(await ids({ instant: "true" })).toEqual([padel.id]);
    expect(await ids({ instant: "false" })).toEqual([nile.id, padel.id]);
    expect(await ids({ payment: "CASH" })).toEqual([padel.id]);
    expect(await ids({ payment: "ONLINE" })).toEqual([nile.id]);
    expect(await ids({ flexible: "true" })).toEqual([padel.id]);
    expect(await ids({ loyalty: "true" })).toEqual([nile.id]);
  });

  it("sorts by the cheapest hour or the soonest start", async () => {
    const { nile, padel } = await setup();
    await prisma.groundSlot.updateMany({
      where: { groundId: padel.groundId },
      data: { price: 30000 },
    });
    expect(await ids({ sort: "PRICE" })).toEqual([padel.id, nile.id]);
    // Midnight to 9 am taken at Wadi Padel: Nile Kickoff is free sooner.
    await prisma.$executeRaw`
      UPDATE "GroundSlot" SET status = 'BLOCKED'
      WHERE "groundId" = ${padel.groundId}::uuid
        AND "startsAt" < ((${tomorrow()}::date + '09:00'::time)::timestamp AT TIME ZONE 'Africa/Cairo')`;
    const sooner = await found({ sort: "SOONEST", limit: 1 });
    expect(sooner.data.map((card) => card.id)).toEqual([nile.id]);
    expect(sooner.total).toBe(2);
    const next = await found({ sort: "SOONEST", limit: 1, cursor: sooner.nextCursor ?? "" });
    expect(next.data.map((card) => card.id)).toEqual([padel.id]);
  });
});

describe("free hours", () => {
  it("counts the venues free to start each hour of a day, by the search's where and what", async () => {
    const { nile } = await setup();
    const date = tomorrow();
    const get = async (params: Record<string, string>) => {
      const res = await router.request(
        `/v1/venues/free-hours?${new URLSearchParams({ marketplace: "EG", date, ...params }).toString()}`,
      );
      expect(res.status).toBe(200);
      return VenueFreeHours.parse(await res.json());
    };
    const all = await get({});
    expect(all.hours).toHaveLength(24);
    // Both live venues open every hour; the draft and the paused one never count.
    expect(all.hours.find((h) => h.hour === 21)?.venues).toBe(2);

    // 9 pm taken at Nile Kickoff: one venue free then.
    await prisma.groundSlot.update({
      where: { id: await slotAt(nile.groundId, "21:00") },
      data: { status: "BLOCKED" },
    });
    const later = await get({});
    expect(later.hours.find((h) => h.hour === 21)?.venues).toBe(1);
    expect(later.hours.find((h) => h.hour === 20)?.venues).toBe(2);

    // Narrowed like the search.
    const padel = await get({ sport: "PADEL" });
    expect(padel.hours.find((h) => h.hour === 20)?.venues).toBe(1);
    const near = await get({
      latitude: String(MAADI.latitude),
      longitude: String(MAADI.longitude),
      radius: "3",
    });
    expect(near.hours.find((h) => h.hour === 20)?.venues).toBe(1);
    // And by the other filters: from 8 pm both charge the peak 750 EGP, before it 600.
    const cheap = await get({ priceMax: "70000" });
    expect(cheap.hours.find((h) => h.hour === 20)?.venues).toBe(0);
    expect(cheap.hours.find((h) => h.hour === 19)?.venues).toBe(2);
    expect((await get({ rating: "4" })).hours.find((h) => h.hour === 19)?.venues).toBe(1);
  });
});

function page0(page: VenueSearchResults) {
  const card = page.data[0];
  if (!card) throw new Error("No venue found.");
  return card;
}
