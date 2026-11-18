import { AdminVenue, page } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { router } from "@/http/router";
import { generationQueue, reconcileGround } from "@/modules/venues/application/slot-generation";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createAdmin, createMarketplace, createStaff } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// The admin Venues table: every venue in any status, newest first, searchable and paged.

const Page = page(AdminVenue).extend({ counts: z.record(z.string(), z.number()) });

let cookie = "";

const get = async (query = "", signedIn = true) => {
  const res = await router.request(`/v1/admin/venues${query}`, {
    headers: { "X-Hagz-Admin": "1", ...(signedIn && { Cookie: cookie }) },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

const list = async (query = "") => {
  const res = await get(query);
  expect(res.status).toBe(200);
  return Page.parse(res.body);
};

const signIn = async () => {
  const { secret } = await createAdmin();
  const start = await router.request("/v1/auth/admin/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ email: "omar@hagz.app", password: "correct horse battery" }),
  });
  const { challengeToken } = (await start.json()) as { challengeToken: string };
  const done = await router.request("/v1/auth/admin/sessions/totp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ challengeToken, code: totpCode(secret, totpStep(new Date())) }),
  });
  expect(done.status).toBe(201);
  return done.headers
    .getSetCookie()
    .map((c) => c.split("; ")[0])
    .join("; ");
};

let marketplaceId = "";
let locationId = "";
let sequence = 0;

const addVenue = async ({
  en,
  ar,
  status = "LIVE",
}: {
  en?: string;
  ar?: string;
  status?: "DRAFT" | "SUBMITTED" | "PROVISIONING" | "LIVE" | "MAINTENANCE";
}) =>
  prisma.venue.create({
    data: {
      marketplaceId,
      locationId,
      slug: `venue-${++sequence}`,
      status,
      translations: {
        create: [
          ...(en ? [{ language: "EN" as const, name: en, description: "", address: "" }] : []),
          ...(ar ? [{ language: "AR" as const, name: ar, description: "", address: "" }] : []),
        ],
      },
    },
  });

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  cookie = await signIn();
  const marketplace = await createMarketplace({ code: "EG" });
  marketplaceId = marketplace.id;
  const cairo = await prisma.location.create({
    data: {
      marketplaceId,
      locality: "GOVERNORATE",
      slug: "cairo",
      translations: { create: [{ language: "EN", name: "Cairo" }] },
    },
  });
  const nasrCity = await prisma.location.create({
    data: {
      marketplaceId,
      parentId: cairo.id,
      locality: "DISTRICT",
      slug: "nasr-city",
      translations: { create: [{ language: "EN", name: "Nasr City" }] },
    },
  });
  locationId = nasrCity.id;
});

describe("GET /admin/venues", () => {
  it("needs a signed-in admin", async () => {
    expect((await get("", false)).status).toBe(401);
  });

  it("lists every venue newest first, with its owner, area and grounds in use", async () => {
    const older = await addVenue({ en: "Older", status: "DRAFT" });
    const venue = await addVenue({ en: "Arena", ar: "أرينا", status: "SUBMITTED" });
    const owner = await createStaff({ phone: "+201001234567" });
    await prisma.venueMembership.create({
      data: { venueId: venue.id, staffId: owner.id, role: "OWNER", permissions: {} },
    });
    const ground = {
      venueId: venue.id,
      sport: "FOOTBALL",
      size: "FIVE_A_SIDE",
      surface: "ARTIFICIAL_TURF",
      environment: "OUTDOOR",
      basePrice: 50_000,
    } as const;
    await prisma.ground.createMany({
      data: [
        { ...ground, position: 0 },
        { ...ground, position: 1, status: "MAINTENANCE" },
        { ...ground, position: 2, status: "DELETED" },
      ],
    });

    const { data, nextCursor, counts } = await list();

    expect(data.map((v) => v.id)).toEqual([venue.id, older.id]);
    expect(data[0]).toMatchObject({
      names: { en: "Arena", ar: "أرينا" },
      status: "SUBMITTED",
      marketplace: { id: marketplaceId, code: "EG" },
      area: "Nasr City, Cairo",
      owner: { id: owner.id, name: owner.name, phone: "+201001234567" },
      groundCount: 2,
    });
    expect(data[1]).toMatchObject({ names: { en: "Older", ar: null }, owner: null });
    expect(nextCursor).toBeNull();
    expect(counts).toEqual({ DRAFT: 1, SUBMITTED: 1, PROVISIONING: 0, LIVE: 0, MAINTENANCE: 0 });
  });

  it("filters by status, keeping every status's count for the tabs", async () => {
    await addVenue({ en: "Draft", status: "DRAFT" });
    const submitted = await addVenue({ en: "Submitted", status: "SUBMITTED" });

    const { data, counts } = await list("?status=SUBMITTED");

    expect(data.map((v) => v.id)).toEqual([submitted.id]);
    expect(counts).toMatchObject({ DRAFT: 1, SUBMITTED: 1 });
  });

  it("searches names in either language and slugs, ignoring case", async () => {
    const arena = await addVenue({ en: "Champions Arena", ar: "ملعب الأبطال" });
    await addVenue({ en: "Other", status: "DRAFT" });

    expect((await list("?q=arena")).data.map((v) => v.id)).toEqual([arena.id]);
    expect((await list(`?q=${encodeURIComponent("الأبطال")}`)).data.map((v) => v.id)).toEqual([
      arena.id,
    ]);
    expect((await list(`?q=${arena.slug}`)).data.map((v) => v.id)).toEqual([arena.id]);
    // Counts follow the search.
    expect((await list("?q=arena")).counts).toMatchObject({ LIVE: 1, DRAFT: 0 });
  });

  it("treats % and _ in a search as plain text", async () => {
    const percent = await addVenue({ en: "100% Football" });
    await addVenue({ en: "Plain" });

    expect((await list(`?q=${encodeURIComponent("%")}`)).data.map((v) => v.id)).toEqual([
      percent.id,
    ]);
    expect((await list("?q=_")).data).toEqual([]);
  });

  it("pages with a cursor", async () => {
    const [a, b, c] = [
      await addVenue({ en: "A" }),
      await addVenue({ en: "B" }),
      await addVenue({ en: "C" }),
    ];

    const first = await list("?limit=2");
    expect(first.data.map((v) => v.id)).toEqual([c.id, b.id]);
    expect(first.nextCursor).toBe(b.id);

    const second = await list(`?limit=2&cursor=${first.nextCursor}`);
    expect(second.data.map((v) => v.id)).toEqual([a.id]);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects a cursor that isn't one", async () => {
    expect((await get("?cursor=nope")).status).toBe(400);
  });
});

describe("GET /admin/venues/{id}", () => {
  it("reads one venue, in any status", async () => {
    const venue = await addVenue({ en: "Arena", status: "DRAFT" });
    const res = await get(`/${venue.id}`);
    expect(res.status).toBe(200);
    expect(AdminVenue.parse(res.body)).toMatchObject({
      id: venue.id,
      names: { en: "Arena", ar: null },
      status: "DRAFT",
      area: "Nasr City, Cairo",
    });
  });

  it("answers 404 for a venue that isn't there", async () => {
    const res = await get("/0190f2a4-0000-7000-8000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VENUE_NOT_FOUND");
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}`, false)).status).toBe(401);
  });
});

describe("GET /admin/venues/{id}/translations", () => {
  it("reads what players see in each language, English first", async () => {
    const venue = await prisma.venue.create({
      data: {
        marketplaceId,
        locationId,
        slug: `venue-${++sequence}`,
        status: "PROVISIONING",
        translations: {
          create: [
            { language: "AR", name: "الساحة", description: null, address: "شارع ٩" },
            { language: "EN", name: "Arena", description: "Two pitches.", address: "9 Street" },
          ],
        },
      },
    });
    const res = await get(`/${venue.id}/translations`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { language: "EN", name: "Arena", description: "Two pitches.", address: "9 Street" },
      { language: "AR", name: "الساحة", description: null, address: "شارع ٩" },
    ]);
  });

  it("leaves out a language nobody has written", async () => {
    const venue = await addVenue({ en: "Arena", status: "DRAFT" });
    const res = await get(`/${venue.id}/translations`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { language: "EN", name: "Arena", description: "", address: "" },
    ]);
  });

  it("answers 404 for a venue that isn't there", async () => {
    const res = await get("/0190f2a4-0000-7000-8000-000000000000/translations");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VENUE_NOT_FOUND");
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/translations`, false)).status).toBe(401);
  });
});

describe("GET /admin/venues/{id}/photos", () => {
  const photo = (venueId: string, position: number, status: "READY" | "PENDING" = "READY") => ({
    venueId,
    key: `venues/${venueId}/${String(position)}-${status}.jpg`,
    type: "IMAGE" as const,
    contentType: "image/jpeg",
    size: 4,
    status,
    position,
  });

  it("reads the ready photos in order, the cover first", async () => {
    const venue = await addVenue({ en: "Arena" });
    await prisma.venueMedia.createMany({
      data: [photo(venue.id, 1), photo(venue.id, 0), photo(venue.id, 2, "PENDING")],
    });
    const res = await get(`/${venue.id}/photos`);
    expect(res.status).toBe(200);
    const data = res.body.data as { url: string; status: string; position: number }[];
    expect(data.map((p) => [p.position, p.status])).toEqual([
      [0, "READY"],
      [1, "READY"],
    ]);
    expect(data[0]?.url).toContain(`venues/${venue.id}/0-READY.jpg`);
  });

  it("answers 404 for a venue that isn't there", async () => {
    const res = await get("/0190f2a4-0000-7000-8000-000000000000/photos");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VENUE_NOT_FOUND");
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/photos`, false)).status).toBe(401);
  });
});

describe("GET /admin/venues/{id}/location", () => {
  it("reads the pin and the area, in both languages", async () => {
    const venue = await addVenue({ en: "Arena" });
    await prisma.$executeRaw`
      UPDATE "Venue" SET coordinates = ST_SetSRID(ST_MakePoint(31.33, 30.06), 4326)::geography
      WHERE id = ${venue.id}::uuid`;
    const res = await get(`/${venue.id}/location`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      marketplace: { id: marketplaceId, code: "EG", names: { en: "Country EG", ar: null } },
      coordinates: { latitude: 30.06, longitude: 31.33 },
      area: { id: locationId, names: { en: "Nasr City, Cairo", ar: null } },
      requestedArea: null,
    });
  });

  it("reads the area the owner asked for, before a pin", async () => {
    const venue = await prisma.venue.create({
      data: {
        marketplaceId,
        slug: `venue-${String(++sequence)}`,
        status: "SUBMITTED",
        requestedArea: "Sheikh Zayed, Giza",
      },
    });
    const res = await get(`/${venue.id}/location`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      marketplace: { id: marketplaceId, code: "EG", names: { en: "Country EG", ar: null } },
      coordinates: null,
      area: null,
      requestedArea: "Sheikh Zayed, Giza",
    });
  });

  it("answers 404 for a venue that isn't there", async () => {
    const res = await get("/0190f2a4-0000-7000-8000-000000000000/location");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VENUE_NOT_FOUND");
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/location`, false)).status).toBe(401);
  });
});

describe("GET /admin/venues/{id}/amenities", () => {
  it("reads what the venue offers with names, prices and layout tiles, by English name", async () => {
    const venue = await addVenue({ en: "Arena" });
    const option = (key: string, en: string, isActive = true, placeable = false) =>
      prisma.amenityOption.create({
        data: {
          marketplaceId,
          key,
          icon: key,
          isActive,
          placeable,
          translations: { create: [{ language: "EN", name: en }] },
        },
      });
    const showers = await option("showers", "Showers");
    const parking = await option("parking", "Parking", false, true);
    await prisma.venueAmenity.createMany({
      data: [
        { venueId: venue.id, marketplaceId, optionId: showers.id, price: null, pricing: null },
        {
          venueId: venue.id,
          marketplaceId,
          optionId: parking.id,
          price: 5000,
          pricing: "PER_BOOKING",
        },
      ],
    });
    // Parking drawn twice on the layout.
    await prisma.venueLayout.create({ data: { venueId: venue.id, columns: 10, rows: 10 } });
    await prisma.venueLayoutItem.createMany({
      data: [0, 3].map((x) => ({
        venueId: venue.id,
        type: "AMENITY" as const,
        optionId: parking.id,
        x,
        y: 0,
        width: 2,
        height: 2,
      })),
    });
    const res = await get(`/${venue.id}/amenities`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      currency: "EGP",
      amenities: [
        {
          optionId: parking.id,
          key: "parking",
          icon: "parking",
          names: { en: "Parking", ar: null },
          isActive: false,
          price: 5000,
          pricing: "PER_BOOKING",
          placeable: true,
          tiles: 2,
        },
        {
          optionId: showers.id,
          key: "showers",
          icon: "showers",
          names: { en: "Showers", ar: null },
          isActive: true,
          price: null,
          pricing: null,
          placeable: false,
          tiles: 0,
        },
      ],
    });
  });

  it("answers 404 for a venue that isn't there", async () => {
    const res = await get("/0190f2a4-0000-7000-8000-000000000000/amenities");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VENUE_NOT_FOUND");
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/amenities`, false)).status).toBe(401);
  });
});

describe("GET /admin/venues/{id}/contact", () => {
  const withContact = async (taxNumber: string | null) => {
    const venue = await addVenue({ en: "Arena", status: "PROVISIONING" });
    await prisma.venue.update({
      where: { id: venue.id },
      data: { phone: "+20235514420", taxNumber },
    });
    return venue;
  };
  // Through the admin endpoint, as the Application tab records it.
  const checked = async (venueId: string, valid: boolean, note: string | null) => {
    const res = await router.request(`/v1/admin/venues/${venueId}/tax-number-check`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Hagz-Admin": "1", Cookie: cookie },
      body: JSON.stringify({ valid, note }),
    });
    expect(res.status).toBe(204);
  };

  it("reads the phone and the tax number with its latest check", async () => {
    const venue = await withContact("512-334-981");
    await checked(venue.id, false, "Not in the register.");
    await checked(venue.id, true, null);
    const res = await get(`/${venue.id}/contact`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      phone: "+20235514420",
      taxNumber: { value: "512-334-981", check: { valid: true, note: null } },
    });
  });

  it("drops a check made on a number that has since changed", async () => {
    const venue = await withContact("111-222-333");
    await checked(venue.id, true, null);
    await prisma.venue.update({ where: { id: venue.id }, data: { taxNumber: "512-334-981" } });
    const res = await get(`/${venue.id}/contact`);
    expect(res.body).toEqual({
      phone: "+20235514420",
      taxNumber: { value: "512-334-981", check: null },
    });
  });

  it("answers 404 for a venue that isn't there", async () => {
    const res = await get("/0190f2a4-0000-7000-8000-000000000000/contact");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VENUE_NOT_FOUND");
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/contact`, false)).status).toBe(401);
  });
});

describe("a venue's settings, for admins", () => {
  const call = async (method: string, path: string, body: unknown) => {
    const res = await router.request(`/v1/admin/venues${path}`, {
      method,
      headers: { "content-type": "application/json", "X-Hagz-Admin": "1", Cookie: cookie },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const eventsOf = (venueId: string, type: string) =>
    prisma.venueEvent.findMany({ where: { venueId, type }, orderBy: { id: "asc" } });

  it("reads the commission and the owner's settings", async () => {
    const venue = await addVenue({ en: "Arena" });
    const res = await get(`/${venue.id}/settings`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      commission: { override: null },
      settings: { autoConfirm: true, paymentMode: "MANUAL", cancellationPolicy: null },
    });
  });

  it("changes the owner's settings, recorded as the admin's", async () => {
    const venue = await addVenue({ en: "Arena" });
    const res = await call("PATCH", `/${venue.id}/settings`, {
      autoConfirm: false,
      paymentMode: "DEPOSIT",
      depositPercent: 30,
      cancellationPolicy: "STRICT",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      settings: { autoConfirm: false, paymentMode: "DEPOSIT", depositPercent: 30 },
    });
    const [changed] = await eventsOf(venue.id, "VENUE_SETTINGS_CHANGED");
    expect(changed?.adminId).not.toBeNull();
    expect(changed?.staffId).toBeNull();
  });

  it("checks settings as a whole, as for the owner", async () => {
    const venue = await addVenue({ en: "Arena" });
    const res = await call("PATCH", `/${venue.id}/settings`, { paymentMode: "DEPOSIT" });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: "INVALID_SETTINGS", field: "depositPercent" });
  });

  it("sets and clears the commission override, each on the history", async () => {
    const venue = await addVenue({ en: "Arena" });
    const set = await call("PUT", `/${venue.id}/commission`, { rate: 800 });
    expect(set.body).toMatchObject({ commission: { override: 800 } });
    // The same rate again changes nothing.
    await call("PUT", `/${venue.id}/commission`, { rate: 800 });
    const cleared = await call("PUT", `/${venue.id}/commission`, { rate: null });
    expect(cleared.body).toMatchObject({ commission: { override: null } });
    const events = await eventsOf(venue.id, "VENUE_COMMISSION_CHANGED");
    expect(events.map((e) => e.data)).toEqual([
      { previous: null, next: 800 },
      { previous: 800, next: null },
    ]);
  });

  it("only takes a rate from 0 to 100%", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await call("PUT", `/${venue.id}/commission`, { rate: 10_001 })).status).toBe(400);
  });

  it("answers 404 for a venue that isn't there", async () => {
    const res = await get("/0190f2a4-0000-7000-8000-000000000000/settings");
    expect(res.status).toBe(404);
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/settings`, false)).status).toBe(401);
  });
});

describe("GET /admin/venues/{id}/grounds", () => {
  it("reads the grounds with their hours, and the layout they're placed on", async () => {
    const venue = await addVenue({ en: "Arena" });
    const ground = await prisma.ground.create({
      data: {
        venueId: venue.id,
        sport: "FOOTBALL",
        size: "FIVE_A_SIDE",
        surface: "ARTIFICIAL_TURF",
        environment: "OUTDOOR",
        position: 0,
        basePrice: 60000,
        translations: { create: [{ language: "EN", name: "Pitch 1" }] },
        settings: { create: {} },
        schedules: { create: [{ dayOfWeek: 4, hours: { "19": "BASE", "20": "PEAK" } }] },
      },
    });
    await prisma.venueLayout.create({ data: { venueId: venue.id, columns: 10, rows: 8 } });
    await prisma.venueLayoutItem.create({
      data: {
        venueId: venue.id,
        type: "GROUND",
        groundId: ground.id,
        x: 1,
        y: 1,
        orientation: "HORIZONTAL",
        width: 4,
        height: 3,
      },
    });

    const res = await get(`/${venue.id}/grounds`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      currency: "EGP",
      grounds: [
        {
          id: ground.id,
          name: "Pitch 1",
          sport: "FOOTBALL",
          openHours: 2,
          schedule: [{ dayOfWeek: 4 }],
          // Not generated yet: a run would make Thursday's two hours each week.
          generation: { generatedUntil: null, generatedAt: null, stale: 0 },
        },
      ],
      layout: {
        saved: true,
        columns: 10,
        rows: 8,
        grounds: [{ groundId: ground.id, x: 1, y: 1, width: 4, height: 3 }],
      },
    });
  });

  it("says how its slots stand, and queues a run on Regenerate", async () => {
    const venue = await addVenue({ en: "Arena" });
    const ground = await prisma.ground.create({
      data: {
        venueId: venue.id,
        sport: "FOOTBALL",
        size: "FIVE_A_SIDE",
        surface: "ARTIFICIAL_TURF",
        environment: "OUTDOOR",
        position: 0,
        basePrice: 60000,
        settings: { create: { scheduleVersion: 1 } },
        schedules: { create: [{ dayOfWeek: 4, hours: { "19": "BASE" } }] },
      },
    });
    const before = (await get(`/${venue.id}/grounds`)).body as {
      grounds: { generation: { drift: { missing: number } } }[];
    };
    // About 13 Thursdays ahead, none generated.
    expect(before.grounds[0]?.generation.drift.missing).toBeGreaterThanOrEqual(12);

    const regenerate = await router.request(
      `/v1/admin/venues/${venue.id}/grounds/${ground.id}/regenerate`,
      { method: "POST", headers: { "X-Hagz-Admin": "1", Cookie: cookie } },
    );
    expect(regenerate.status).toBe(202);
    const jobs = await generationQueue().getJobs(["waiting"]);
    expect(jobs.map((job) => job.data.groundId)).toEqual([ground.id]);

    await reconcileGround(ground.id);
    const after = (await get(`/${venue.id}/grounds`)).body as {
      grounds: { generation: Record<string, unknown> }[];
    };
    expect(after.grounds[0]?.generation).toMatchObject({
      stale: 0,
      drift: { missing: 0, extra: 0, wrong: 0 },
    });
    expect(after.grounds[0]?.generation.generatedUntil).not.toBeNull();
    expect(after.grounds[0]?.generation.generatedAt).not.toBeNull();
  });

  it("won't regenerate a ground of another venue", async () => {
    const venue = await addVenue({ en: "Arena" });
    const res = await router.request(
      `/v1/admin/venues/${venue.id}/grounds/0190f2a4-0000-7000-8000-000000000000/regenerate`,
      { method: "POST", headers: { "X-Hagz-Admin": "1", Cookie: cookie } },
    );
    expect(res.status).toBe(404);
  });

  it("answers 404 for a venue that isn't there", async () => {
    const res = await get("/0190f2a4-0000-7000-8000-000000000000/grounds");
    expect(res.status).toBe(404);
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/grounds`, false)).status).toBe(401);
  });
});

describe("GET /admin/venues/{id}/slots", () => {
  const HOUR = 3_600_000;
  // A local date and hour in Cairo, from an instant.
  const cairo = (instant: Date) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(instant)
        .map((part) => [part.type, part.value]),
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
  };
  // A Cairo midnight about a month ahead: slots can only be 90 days out (a CHECK constraint).
  const midnightAhead = () => {
    let at = Math.ceil((Date.now() + 30 * 24 * HOUR) / HOUR) * HOUR;
    while (cairo(new Date(at)).hour !== 0) at += HOUR;
    return at;
  };

  const addGround = (venueId: string, name: string, status: "ACTIVE" | "DELETED" = "ACTIVE") =>
    prisma.ground.create({
      data: {
        venueId,
        sport: "FOOTBALL",
        size: "FIVE_A_SIDE",
        surface: "ARTIFICIAL_TURF",
        environment: "OUTDOOR",
        position: 0,
        basePrice: 60000,
        status,
        translations: { create: [{ language: "EN", name }] },
        settings: { create: {} },
      },
    });
  const addSlot = (venueId: string, groundId: string, startsAt: number) =>
    prisma.groundSlot.create({
      data: {
        venueId,
        groundId,
        startsAt: new Date(startsAt),
        endsAt: new Date(startsAt + HOUR),
        tier: "PEAK",
        price: 75000,
        scheduleVersion: 1,
      },
    });

  it("says there are none before any are generated, on today in the venue's timezone", async () => {
    const venue = await addVenue({ en: "Arena" });
    const ground = await addGround(venue.id, "Pitch 1");

    const res = await get(`/${venue.id}/slots`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      timezone: "Africa/Cairo",
      currency: "EGP",
      date: cairo(new Date()).date,
      days: null,
      grounds: [{ id: ground.id, name: "Pitch 1", sport: "FOOTBALL", size: "FIVE_A_SIDE" }],
      slots: [],
    });
  });

  it("reads a local day, a slot after local midnight belonging to the next one", async () => {
    const venue = await addVenue({ en: "Arena" });
    const ground = await addGround(venue.id, "Pitch 1");
    const midnight = midnightAhead();
    // 11 pm, then 12 am the next day, then 7 pm the day after.
    const late = await addSlot(venue.id, ground.id, midnight - HOUR);
    const first = await addSlot(venue.id, ground.id, midnight);
    const evening = await addSlot(venue.id, ground.id, midnight + 43 * HOUR);
    const day = cairo(late.startsAt).date;
    const next = cairo(first.startsAt).date;

    const res = await get(`/${venue.id}/slots?date=${day}`);
    expect(res.body).toMatchObject({
      date: day,
      days: { first: day, last: cairo(evening.startsAt).date },
      slots: [
        {
          id: late.id,
          groundId: ground.id,
          startsAt: late.startsAt.toISOString(),
          endsAt: late.endsAt.toISOString(),
          tier: "PEAK",
          price: 75000,
          status: "AVAILABLE",
          isManual: false,
          bookingId: null,
        },
      ],
    });
    const after = await get(`/${venue.id}/slots?date=${next}`);
    expect((after.body.slots as { id: string }[]).map((slot) => slot.id)).toEqual([first.id]);
  });

  it("reads a week from a day, and nothing past it", async () => {
    const venue = await addVenue({ en: "Arena" });
    const ground = await addGround(venue.id, "Pitch 1");
    const midnight = midnightAhead();
    const first = await addSlot(venue.id, ground.id, midnight + 19 * HOUR);
    // Evening on the seventh day, then midday on the eighth, past the week (clear of a clock change).
    const seventh = await addSlot(venue.id, ground.id, midnight + (6 * 24 + 20) * HOUR);
    await addSlot(venue.id, ground.id, midnight + (7 * 24 + 12) * HOUR);
    const day = cairo(first.startsAt).date;

    const res = await get(`/${venue.id}/slots?date=${day}&span=7`);
    expect(res.body).toMatchObject({ date: day });
    expect((res.body.slots as { id: string }[]).map((slot) => slot.id)).toEqual([
      first.id,
      seventh.id,
    ]);
  });

  it("refuses a span longer than a week", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/slots?span=8`)).status).toBe(400);
  });

  it("opens on the nearest day with slots when today has none", async () => {
    const venue = await addVenue({ en: "Arena" });
    const ground = await addGround(venue.id, "Pitch 1");
    const slot = await addSlot(venue.id, ground.id, midnightAhead() + 19 * HOUR);

    const res = await get(`/${venue.id}/slots`);
    expect(res.body).toMatchObject({
      date: cairo(slot.startsAt).date,
      slots: [{ id: slot.id }],
    });
  });

  it("leaves out deleted grounds and their slots", async () => {
    const venue = await addVenue({ en: "Arena" });
    const gone = await addGround(venue.id, "Old pitch", "DELETED");
    await addSlot(venue.id, gone.id, midnightAhead() + 19 * HOUR);

    const res = await get(`/${venue.id}/slots`);
    expect(res.body).toMatchObject({ days: null, grounds: [], slots: [] });
  });

  it("refuses a date that isn't one", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/slots?date=2026-13-40`)).status).toBe(400);
  });

  it("answers 404 for a venue that isn't there", async () => {
    expect((await get("/0190f2a4-0000-7000-8000-000000000000/slots")).status).toBe(404);
  });

  it("needs a signed-in admin", async () => {
    const venue = await addVenue({ en: "Arena" });
    expect((await get(`/${venue.id}/slots`, false)).status).toBe(401);
  });
});
