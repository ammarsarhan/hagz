import { PublicVenue, VenueAvailability } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { venueAvailability } from "@/modules/venues/application/public-venue";
import { reconcileGround } from "@/modules/venues/application/slot-generation";
import { prisma } from "@/platform/db/prisma";
import { storage } from "@/platform/storage/storage";
import { resetDatabase } from "../../support/database";
import { createMarketplace, createVenue } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// The venue page (PR 3.2): a live or paused venue as a guest sees it, and its free times by day.

const HOUR = 3_600_000;

const get = (path: string, language = "en") =>
  router.request(`/v1${path}`, { headers: { "Accept-Language": language } });

const groundData = (venueId: string, position: number) => ({
  venueId,
  sport: "FOOTBALL" as const,
  size: "FIVE_A_SIDE" as const,
  surface: "ARTIFICIAL_TURF" as const,
  environment: "OUTDOOR" as const,
  position,
  basePrice: 60000,
  peakPrice: 75000,
  discountPrice: 45000,
});

// Open every hour of every day, so any day has free times whatever the time the test runs.
const allDay = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  hours: Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => [String(hour), hour >= 18 ? "PEAK" : "BASE"]),
  ),
}));

// A live venue in Maadi, Cairo, written in both languages, with two photos (and one still
// uploading), parking, the moderate policy, an active ground open all day, one under maintenance
// and one deleted.
const aVenue = async () => {
  const marketplace = await createMarketplace();
  const venue = await createVenue(marketplace.id);
  const cairo = await prisma.location.findUniqueOrThrow({ where: { id: venue.locationId ?? "" } });
  await prisma.locationTranslation.createMany({
    data: [
      { locationId: cairo.id, language: "EN", name: "Cairo" },
      { locationId: cairo.id, language: "AR", name: "القاهرة" },
    ],
  });
  const maadi = await prisma.location.create({
    data: {
      marketplaceId: marketplace.id,
      parentId: cairo.id,
      locality: "DISTRICT",
      slug: `maadi-${venue.slug}`,
      translations: {
        create: [
          { language: "EN", name: "Maadi" },
          { language: "AR", name: "المعادي" },
        ],
      },
    },
  });
  await prisma.venue.update({
    where: { id: venue.id },
    data: {
      locationId: maadi.id,
      phone: "+201001234567",
      averageRating: "4.62",
      reviewCount: 13,
      translations: {
        create: [
          { language: "EN", name: "Wadi Degla", description: "Lit pitches.", address: "Road 9" },
          { language: "AR", name: "وادي دجلة", description: null, address: "شارع 9" },
        ],
      },
      settings: {
        create: { defaultPermissions: {}, cancellationPolicy: "MODERATE", minimumNotice: 60 },
      },
      media: {
        create: [
          {
            key: `b-${venue.id}`,
            type: "IMAGE",
            contentType: "image/jpeg",
            size: 1,
            position: 1,
            status: "READY",
          },
          {
            key: `a-${venue.id}`,
            type: "IMAGE",
            contentType: "image/jpeg",
            size: 1,
            position: 0,
            status: "READY",
          },
          { key: `c-${venue.id}`, type: "IMAGE", contentType: "image/jpeg", size: 1, position: 2 },
        ],
      },
    },
  });
  await prisma.$executeRaw`
    UPDATE "Venue" SET coordinates = ST_SetSRID(ST_MakePoint(31.25, 29.96), 4326)::geography
    WHERE id = ${venue.id}::uuid`;

  const parking = await prisma.amenityOption.create({
    data: {
      marketplaceId: marketplace.id,
      key: "parking",
      icon: "parking",
      placeable: true,
      translations: { create: [{ language: "EN", name: "Parking" }] },
    },
  });
  await prisma.venueAmenity.create({
    data: { venueId: venue.id, optionId: parking.id, marketplaceId: marketplace.id },
  });

  const active = await prisma.ground.create({
    data: {
      ...groundData(venue.id, 0),
      translations: { create: [{ language: "EN", name: "Pitch 1" }] },
      settings: { create: { scheduleVersion: 1, maximumSlots: 2 } },
      schedules: { create: allDay },
    },
  });
  const resting = await prisma.ground.create({
    data: {
      ...groundData(venue.id, 1),
      status: "MAINTENANCE",
      settings: { create: { scheduleVersion: 1 } },
      schedules: { create: allDay },
    },
  });
  await prisma.ground.create({ data: { ...groundData(venue.id, 2), status: "DELETED" } });
  await reconcileGround(active.id);
  await reconcileGround(resting.id);
  return { venue, active, resting, parking };
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("reading a venue", () => {
  it("shows a guest the venue in their language", async () => {
    const { venue, active, resting, parking } = await aVenue();
    const res = await get(`/venues/${venue.slug}`);
    expect(res.status).toBe(200);
    const page = PublicVenue.parse(await res.json());

    expect(page).toMatchObject({
      id: venue.id,
      slug: venue.slug,
      status: "LIVE",
      name: "Wadi Degla",
      description: "Lit pitches.",
      marketplace: { currency: "EGP", timezone: "Africa/Cairo" },
      location: {
        area: "Maadi, Cairo",
        address: "Road 9",
        coordinates: { latitude: 29.96, longitude: 31.25 },
      },
      rating: { average: 4.62, count: 13 },
      amenities: [{ id: parking.id, key: "parking", name: "Parking", price: null, pricing: null }],
      layout: null,
      booking: {
        instantConfirmation: true,
        minimumNotice: 60,
        payment: { mode: "MANUAL", depositPercent: null },
        cancellation: {
          policy: "MODERATE",
          tiers: [
            { hours: 24, refundPercent: 100 },
            { hours: 6, refundPercent: 50 },
          ],
        },
        loyalty: null,
      },
    });
    // The phone comes with a booking, not the public page.
    expect(page).not.toHaveProperty("phone");
    // Ready photos only, cover first.
    expect(page.photos.map((p) => p.url)).toEqual([
      storage.publicUrl(`a-${venue.id}`),
      storage.publicUrl(`b-${venue.id}`),
    ]);
    // Deleted grounds are gone; one under maintenance shows, greyed out by the app.
    expect(page.grounds).toEqual([
      {
        id: active.id,
        name: "Pitch 1",
        sport: "FOOTBALL",
        size: "FIVE_A_SIDE",
        surface: "ARTIFICIAL_TURF",
        environment: "OUTDOOR",
        status: "ACTIVE",
        priceFrom: 60000,
        minimumSlots: 1,
        maximumSlots: 2,
      },
      expect.objectContaining({ id: resting.id, name: null, status: "MAINTENANCE" }),
    ]);
    expect(page.booking.cancellation?.summary[0]).toBe(
      "Free cancellation up to 24 hours before it starts.",
    );
  });

  it("speaks Arabic, and falls back to the language the venue wrote in", async () => {
    const { venue, parking } = await aVenue();
    const page = PublicVenue.parse(await (await get(`/venues/${venue.slug}`, "ar")).json());
    expect(page).toMatchObject({
      name: "وادي دجلة",
      description: null,
      location: { area: "المعادي، القاهرة", address: "شارع 9" },
      amenities: [{ id: parking.id, name: "Parking" }],
      grounds: [{ name: "Pitch 1" }, { name: null }],
    });
    expect(page.booking.cancellation?.summary[0]).toBe("إلغاء مجاني حتى 24 ساعة قبل الموعد.");
  });

  it("shows the map once the venue has drawn one", async () => {
    const { venue, active, parking } = await aVenue();
    await prisma.venueLayout.create({
      data: {
        venueId: venue.id,
        columns: 16,
        rows: 19,
        entrances: [{ side: "BOTTOM", offset: 3 }],
        items: {
          create: [
            {
              type: "GROUND",
              groundId: active.id,
              x: 0,
              y: 0,
              orientation: "HORIZONTAL",
              width: 4,
              height: 2,
            },
            { type: "AMENITY", optionId: parking.id, x: 0, y: 5, width: 2, height: 2 },
          ],
        },
      },
    });
    const page = PublicVenue.parse(await (await get(`/venues/${venue.slug}`)).json());
    expect(page.layout).toEqual({
      columns: 16,
      rows: 19,
      grounds: [
        { groundId: active.id, x: 0, y: 0, orientation: "HORIZONTAL", width: 4, height: 2 },
      ],
      amenities: [{ optionId: parking.id, x: 0, y: 5, width: 2, height: 2 }],
      entrances: [{ side: "BOTTOM", offset: 3 }],
    });
  });

  it("shows a paused venue, and hides ones that haven't gone live", async () => {
    const { venue } = await aVenue();
    await prisma.venue.update({ where: { id: venue.id }, data: { status: "MAINTENANCE" } });
    const paused = await get(`/venues/${venue.slug}`);
    expect(paused.status).toBe(200);
    expect(PublicVenue.parse(await paused.json()).status).toBe("MAINTENANCE");

    for (const status of ["DRAFT", "SUBMITTED", "PROVISIONING"] as const) {
      await prisma.venue.update({ where: { id: venue.id }, data: { status } });
      const res = await get(`/venues/${venue.slug}`);
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ code: "VENUE_NOT_FOUND" });
      expect((await get(`/venues/${venue.slug}/availability`)).status).toBe(404);
    }
    expect((await get("/venues/nosuchvenue")).status).toBe(404);
  });
});

describe("free times", () => {
  it("lists a day's free slots on active grounds", async () => {
    const { venue, active } = await aVenue();
    const today = VenueAvailability.parse(
      await (await get(`/venues/${venue.slug}/availability`)).json(),
    );
    expect(today).toMatchObject({
      date: today.days.first,
      timezone: "Africa/Cairo",
      currency: "EGP",
    });
    expect(today.days.last > today.days.first).toBe(true);

    // Tomorrow, whole: 24 hours (23 or 25 when the clocks change) on the active ground only.
    const tomorrow = new Date(`${today.days.first}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    const res = await get(`/venues/${venue.slug}/availability?date=${date}`);
    expect(res.status).toBe(200);
    const day = VenueAvailability.parse(await res.json());
    expect(day.date).toBe(date);
    expect(day.slots.length).toBeGreaterThanOrEqual(23);
    expect(new Set(day.slots.map((s) => s.groundId))).toEqual(new Set([active.id]));
    expect(day.slots[0]).toMatchObject({ tier: "BASE", price: 60000 });
    expect(day.slots.at(-1)).toMatchObject({ tier: "PEAK", price: 75000 });

    // Taken and blocked slots aren't free.
    const [first, second] = day.slots;
    await prisma.groundSlot.update({ where: { id: second?.id }, data: { status: "BLOCKED" } });
    const after = VenueAvailability.parse(
      await (await get(`/venues/${venue.slug}/availability?date=${date}`)).json(),
    );
    expect(after.slots.map((s) => s.id)).toContain(first?.id);
    expect(after.slots.map((s) => s.id)).not.toContain(second?.id);
  });

  it("leaves out slots inside the venue's notice", async () => {
    const { venue } = await aVenue();
    const slots = await prisma.groundSlot.findMany({
      where: { venueId: venue.id, ground: { status: "ACTIVE" } },
      orderBy: { startsAt: "asc" },
      take: 40,
    });
    const target = slots[30];
    if (!target) throw new Error("No slots generated.");
    // Half an hour before the slot, with an hour's notice: it's too late for it, not the next one.
    const now = new Date(target.startsAt.getTime() - HOUR / 2);
    const [local] = await prisma.$queryRaw<{ date: string }[]>`
      SELECT (${target.startsAt}::timestamptz AT TIME ZONE 'Africa/Cairo')::date::text AS date`;
    const day = await venueAvailability(venue.slug, { date: local?.date }, { now: () => now });
    expect(day.slots.map((s) => s.id)).not.toContain(target.id);
    expect(day.slots[0]?.startsAt).toBe(slots[31]?.startsAt.toISOString());
  });

  it("has nothing free while the venue is paused", async () => {
    const { venue } = await aVenue();
    await prisma.venue.update({ where: { id: venue.id }, data: { status: "MAINTENANCE" } });
    const day = VenueAvailability.parse(
      await (await get(`/venues/${venue.slug}/availability`)).json(),
    );
    expect(day.slots).toEqual([]);
  });

  it("refuses a date that isn't one", async () => {
    const { venue } = await aVenue();
    expect((await get(`/venues/${venue.slug}/availability?date=tomorrow`)).status).toBe(400);
  });
});
