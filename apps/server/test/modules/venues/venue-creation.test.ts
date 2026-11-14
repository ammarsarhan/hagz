import { randomUUID } from "node:crypto";
import { VenueSetup, type CreateVenue, type StaffPermissions } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import {
  DEFAULT_INVITATION_PERMISSIONS,
  NO_PERMISSIONS,
} from "@/modules/venues/domain/permissions";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { addMember, createMarketplace, createStaff, createVenue } from "../../support/factories";
import { resetRedis } from "../../support/redis";

const call = async (
  staffId: string,
  method: string,
  path: string,
  body?: unknown,
  language = "en",
) =>
  router.request(`/v1/staff${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "Accept-Language": language,
      Authorization: `Bearer ${await signJwt({ sub: staffId, sid: randomUUID() }, { audience: "staff", ttlSeconds: 600 })}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// Permissions as stored: every area, `none` unless given.
const only = (granted: Partial<StaffPermissions>): StaffPermissions => ({
  ...NO_PERMISSIONS,
  ...granted,
});

const problem = async (res: Response) => {
  const body = (await res.json()) as Record<string, unknown>;
  delete body.requestId;
  return body;
};

// Maadi, Cairo.
const MAADI = { latitude: 29.9602, longitude: 31.2569 };
const EGYPT = {
  minimumLatitude: 21.5,
  maximumLatitude: 32,
  minimumLongitude: 24.5,
  maximumLongitude: 37,
};

let phones = 0;
const someStaff = (language: "AR" | "EN" = "EN") =>
  createStaff({ phone: `+2010022${String(phones++).padStart(5, "0")}`, language });

// An active marketplace with Egypt's box and an area in it.
const egypt = async () => {
  const marketplace = await createMarketplace({ bounds: EGYPT });
  const area = await prisma.location.create({
    data: { marketplaceId: marketplace.id, locality: "DISTRICT", slug: `maadi-${phones}` },
  });
  return { marketplace, area };
};

const draft = (locationId: string, overrides: Partial<CreateVenue> = {}): CreateVenue => ({
  name: "Champions Arena",
  coordinates: MAADI,
  placeId: "ChIJ-maadi-street-9",
  locationId,
  ...overrides,
});

describe("creating a venue", () => {
  beforeEach(async () => {
    await resetDatabase();
    await resetRedis();
  });

  it("creates a draft owned by the caller, with its checklist", async () => {
    const { marketplace, area } = await egypt();
    const owner = await someStaff("EN");

    const res = await call(owner.id, "POST", "/venues", draft(area.id));
    expect(res.status).toBe(201);
    const setup = VenueSetup.parse(await res.json());

    expect(setup.venue).toMatchObject({ status: "DRAFT", name: "Champions Arena" });
    expect(setup.venue.slug).toMatch(/^[a-hjkmnp-z2-9]{8}$/);
    expect(setup.items.map((item) => [item.key, item.state])).toEqual([
      ["DETAILS", "MISSING"],
      ["LOCATION", "DONE"],
      ["PHOTOS", "MISSING"],
      ["GROUNDS", "MISSING"],
      ["SCHEDULES", "BLOCKED"],
      ["SETTINGS", "MISSING"],
      ["AMENITIES", "MISSING"],
      ["TAX_NUMBER", "MISSING"],
    ]);
    expect(setup.required).toEqual({ done: 1, total: 6 });
    expect(setup.canSubmit).toBe(false);

    const venue = await prisma.venue.findUniqueOrThrow({
      where: { id: setup.venue.id },
      include: { translations: true, settings: true, memberships: true, events: true },
    });
    expect(venue).toMatchObject({
      marketplaceId: marketplace.id,
      locationId: area.id,
      placeId: "ChIJ-maadi-street-9",
    });
    expect(venue.translations).toEqual([
      expect.objectContaining({ language: "EN", name: "Champions Arena", description: null }),
    ]);
    expect(venue.memberships).toEqual([
      expect.objectContaining({ staffId: owner.id, role: "OWNER" }),
    ]);
    expect(venue.settings).toMatchObject({
      cancellationPolicy: null,
      defaultPermissions: DEFAULT_INVITATION_PERMISSIONS,
    });
    expect(venue.events).toEqual([
      expect.objectContaining({ type: "VENUE_CREATED", staffId: owner.id, adminId: null }),
    ]);

    const [point] = await prisma.$queryRaw<{ latitude: number; longitude: number }[]>`
      SELECT ST_Y(coordinates::geometry) AS latitude, ST_X(coordinates::geometry) AS longitude
      FROM "Venue" WHERE id = ${venue.id}::uuid`;
    expect(point).toEqual(MAADI);
  });

  it("stores the name in the owner's app language, whatever the request asks for", async () => {
    const { area } = await egypt();
    const owner = await someStaff("AR");

    const res = await call(owner.id, "POST", "/venues", draft(area.id, { name: "ملعب الأبطال" }));
    expect(res.status).toBe(201);
    const { venue } = VenueSetup.parse(await res.json());
    // No English name yet, so the English response falls back to the one there is.
    expect(venue.name).toBe("ملعب الأبطال");
    const translations = await prisma.venueTranslation.findMany({ where: { venueId: venue.id } });
    expect(translations.map((t) => t.language)).toEqual(["AR"]);
  });

  it("works without a Google place id", async () => {
    const { area } = await egypt();
    const owner = await someStaff();
    // Left out of the JSON body entirely.
    const dropped = { ...draft(area.id), placeId: undefined };

    const res = await call(owner.id, "POST", "/venues", dropped);
    expect(res.status).toBe(201);
    const { venue } = VenueSetup.parse(await res.json());
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).placeId).toBeNull();
  });

  describe("one unfinished venue per owner", () => {
    it("refuses a second while the first isn't live, naming the first", async () => {
      const { area } = await egypt();
      const owner = await someStaff();
      const first = VenueSetup.parse(
        await (await call(owner.id, "POST", "/venues", draft(area.id))).json(),
      );

      for (const status of ["DRAFT", "SUBMITTED", "PROVISIONING"] as const) {
        await prisma.venue.update({ where: { id: first.venue.id }, data: { status } });
        const res = await call(owner.id, "POST", "/venues", draft(area.id, { name: "Second" }));
        expect(res.status).toBe(409);
        expect(await problem(res)).toMatchObject({
          code: "UNFINISHED_VENUE_EXISTS",
          venueId: first.venue.id,
          venueStatus: status,
        });
      }
      expect(await prisma.venue.count()).toBe(1);
    });

    it("allows another once the first is live or paused", async () => {
      const { area } = await egypt();
      const owner = await someStaff();
      const first = VenueSetup.parse(
        await (await call(owner.id, "POST", "/venues", draft(area.id))).json(),
      );
      await prisma.venue.update({ where: { id: first.venue.id }, data: { status: "LIVE" } });
      expect((await call(owner.id, "POST", "/venues", draft(area.id))).status).toBe(201);

      const owned = await prisma.venueMembership.count({ where: { staffId: owner.id } });
      expect(owned).toBe(2);
    });

    it("only counts venues they own, not ones they work at", async () => {
      const { marketplace, area } = await egypt();
      const someoneElses = await createVenue(marketplace.id);
      const member = await someStaff();
      await addMember(someoneElses.id, member.id);

      expect((await call(member.id, "POST", "/venues", draft(area.id))).status).toBe(201);
    });

    it("lets only one of two simultaneous requests through", async () => {
      const { area } = await egypt();
      const owner = await someStaff();

      const statuses = await Promise.all(
        [1, 2].map(async (n) => {
          const res = await call(owner.id, "POST", "/venues", draft(area.id, { name: `Try ${n}` }));
          return res.status;
        }),
      );
      expect(statuses.sort()).toEqual([201, 409]);
      expect(await prisma.venue.count()).toBe(1);
    });
  });

  describe("where it is", () => {
    it("needs an area that exists", async () => {
      await egypt();
      const owner = await someStaff();
      const res = await call(owner.id, "POST", "/venues", draft(randomUUID()));
      expect(res.status).toBe(422);
      expect(await problem(res)).toMatchObject({ code: "LOCATION_NOT_FOUND" });
    });

    it("needs the area's marketplace to be active", async () => {
      const marketplace = await createMarketplace({ isActive: false, bounds: EGYPT });
      const area = await prisma.location.create({
        data: { marketplaceId: marketplace.id, locality: "DISTRICT", slug: "dormant" },
      });
      const owner = await someStaff();
      const res = await call(owner.id, "POST", "/venues", draft(area.id));
      expect(res.status).toBe(422);
      expect(await problem(res)).toMatchObject({ code: "LOCATION_NOT_FOUND" });
    });

    it("refuses a pin outside the area's country", async () => {
      const { area } = await egypt();
      const owner = await someStaff();
      const dubai = { latitude: 25.2048, longitude: 55.2708 };

      const res = await call(owner.id, "POST", "/venues", draft(area.id, { coordinates: dubai }));
      expect(res.status).toBe(422);
      expect(await problem(res)).toMatchObject({ code: "LOCATION_OUTSIDE_MARKETPLACE" });
      expect(await prisma.venue.count()).toBe(0);
    });

    it("skips the check for a marketplace without a box", async () => {
      const marketplace = await createMarketplace();
      const area = await prisma.location.create({
        data: { marketplaceId: marketplace.id, locality: "DISTRICT", slug: "anywhere" },
      });
      const owner = await someStaff();
      const res = await call(
        owner.id,
        "POST",
        "/venues",
        draft(area.id, { coordinates: { latitude: 25.2, longitude: 55.27 } }),
      );
      expect(res.status).toBe(201);
    });
  });

  describe("an area Hagz doesn't cover yet", () => {
    const requested = (marketplace: string, overrides: Partial<CreateVenue> = {}): CreateVenue => ({
      ...draft(randomUUID(), overrides),
      locationId: undefined,
      requestedArea: { name: "Sheikh Zayed, Giza", marketplace },
    });

    it("keeps the owner's words in place of an area, in the country they named", async () => {
      const marketplace = await createMarketplace({ code: "EG", bounds: EGYPT });
      const owner = await someStaff();

      // The code is read case-blind, as Google sends it either way.
      const res = await call(owner.id, "POST", "/venues", requested("eg"));
      expect(res.status).toBe(201);
      const { venue } = VenueSetup.parse(await res.json());

      const row = await prisma.venue.findUniqueOrThrow({
        where: { id: venue.id },
        include: { events: true },
      });
      expect(row).toMatchObject({
        marketplaceId: marketplace.id,
        locationId: null,
        requestedArea: "Sheikh Zayed, Giza",
      });
      expect(row.events[0]?.data).toMatchObject({
        locationId: null,
        requestedArea: { name: "Sheikh Zayed, Giza", marketplace: "EG" },
      });
    });

    it("needs a country Hagz operates in", async () => {
      await createMarketplace({ code: "SA", isActive: false });
      const owner = await someStaff();
      for (const code of ["SA", "AE"]) {
        const res = await call(owner.id, "POST", "/venues", requested(code));
        expect(res.status).toBe(422);
        expect(await problem(res)).toMatchObject({ code: "MARKETPLACE_NOT_FOUND" });
      }
      expect(await prisma.venue.count()).toBe(0);
    });

    it("refuses a pin outside that country", async () => {
      await createMarketplace({ code: "EG", bounds: EGYPT });
      const owner = await someStaff();
      const dubai = { latitude: 25.2048, longitude: 55.2708 };

      const res = await call(owner.id, "POST", "/venues", requested("EG", { coordinates: dubai }));
      expect(res.status).toBe(422);
      expect(await problem(res)).toMatchObject({ code: "LOCATION_OUTSIDE_MARKETPLACE" });
    });

    it("takes an area from the list or a requested one, never both or neither", async () => {
      const { area } = await egypt();
      const owner = await someStaff();
      const both = { ...requested("EG"), locationId: area.id };
      const neither = { ...requested("EG"), requestedArea: undefined };
      const unnamed = { ...requested("EG"), requestedArea: { name: " ", marketplace: "EG" } };

      for (const body of [both, neither, unnamed]) {
        const res = await call(owner.id, "POST", "/venues", body);
        expect(res.status).toBe(400);
        expect(await problem(res)).toMatchObject({ code: "VALIDATION_FAILED" });
      }
    });
  });

  it("validates the name and the pin", async () => {
    const { area } = await egypt();
    const owner = await someStaff();
    for (const body of [
      draft(area.id, { name: " " }),
      draft(area.id, { name: "x".repeat(61) }),
      draft(area.id, { coordinates: { latitude: 91, longitude: 31 } }),
    ]) {
      const res = await call(owner.id, "POST", "/venues", body);
      expect(res.status).toBe(400);
      expect(await problem(res)).toMatchObject({ code: "VALIDATION_FAILED" });
    }
  });

  it("refuses a suspended account", async () => {
    const { area } = await egypt();
    const owner = await someStaff();
    await prisma.staff.update({ where: { id: owner.id }, data: { status: "SUSPENDED" } });

    const res = await call(owner.id, "POST", "/venues", draft(area.id));
    expect(res.status).toBe(403);
    expect(await problem(res)).toMatchObject({ code: "ACCOUNT_SUSPENDED" });
  });
});

describe("the setup checklist", () => {
  beforeEach(async () => {
    await resetDatabase();
    await resetRedis();
  });

  const created = async () => {
    const { area } = await egypt();
    const owner = await someStaff();
    const res = await call(owner.id, "POST", "/venues", draft(area.id));
    return { owner, setup: VenueSetup.parse(await res.json()) };
  };

  it("matches what creating the venue answered, and follows its data", async () => {
    const { owner, setup } = await created();
    const path = `/venues/${setup.venue.id}/setup`;

    const first = await call(owner.id, "GET", path);
    expect(first.status).toBe(200);
    expect(VenueSetup.parse(await first.json())).toEqual(setup);

    await prisma.venue.update({ where: { id: setup.venue.id }, data: { phone: "+201001112222" } });
    await prisma.venueTranslation.update({
      where: { venueId_language: { venueId: setup.venue.id, language: "EN" } },
      data: { description: "Three 5-a-side pitches.", address: "12 Street 9, Maadi" },
    });
    await prisma.venueSettings.update({
      where: { venueId: setup.venue.id },
      data: { cancellationPolicy: "MODERATE" },
    });

    await prisma.venueMedia.createMany({
      data: [0, 1, 2].map((position) => ({
        venueId: setup.venue.id,
        key: `venues/${setup.venue.id}/${position}.jpg`,
        type: "IMAGE" as const,
        contentType: "image/jpeg",
        size: 4,
        status: "READY" as const,
        position,
      })),
    });

    await prisma.ground.create({
      data: {
        venueId: setup.venue.id,
        sport: "FOOTBALL",
        size: "FIVE_A_SIDE",
        surface: "ARTIFICIAL_TURF",
        environment: "OUTDOOR",
        position: 0,
        basePrice: 60000,
        schedules: { create: { dayOfWeek: 4, hours: { "19": "BASE" } } },
      },
    });

    const after = VenueSetup.parse(await (await call(owner.id, "GET", path)).json());
    expect(after.required).toEqual({ done: 6, total: 6 });
    expect(after.canSubmit).toBe(true);
  });

  it("is for members with venue: view", async () => {
    const { setup } = await created();
    const path = `/venues/${setup.venue.id}/setup`;

    const viewer = await someStaff();
    await addMember(setup.venue.id, viewer.id, { permissions: only({ venue: "view" }) });
    expect((await call(viewer.id, "GET", path)).status).toBe(200);

    const frontDesk = await someStaff();
    await addMember(setup.venue.id, frontDesk.id, {
      permissions: only({ bookings: "manage" }),
    });
    const denied = await call(frontDesk.id, "GET", path);
    expect(denied.status).toBe(403);
    expect(await problem(denied)).toMatchObject({ code: "PERMISSION_DENIED", area: "venue" });

    const stranger = await someStaff();
    const hidden = await call(stranger.id, "GET", path);
    expect(hidden.status).toBe(404);
    expect(await problem(hidden)).toMatchObject({ code: "VENUE_NOT_FOUND" });
  });
});
