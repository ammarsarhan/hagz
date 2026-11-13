import { randomUUID } from "node:crypto";
import {
  StaffVenueDetail,
  VenueSetup,
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

const EGYPT = {
  minimumLatitude: 21.5,
  maximumLatitude: 32,
  minimumLongitude: 24.5,
  maximumLongitude: 37,
};
const MAADI = { latitude: 29.9602, longitude: 31.2569 };
const ZAMALEK = { latitude: 30.0609, longitude: 31.2197 };

let phones = 0;
const someStaff = () =>
  createStaff({ phone: `+2010033${String(phones++).padStart(5, "0")}`, language: "EN" });

// A fresh draft in Maadi, with its owner, its marketplace and a second area there.
const aDraft = async () => {
  const marketplace = await createMarketplace({ bounds: EGYPT });
  const area = (slug: string) =>
    prisma.location.create({
      data: { marketplaceId: marketplace.id, locality: "DISTRICT", slug: `${slug}-${phones}` },
    });
  const maadi = await area("maadi");
  const zamalek = await area("zamalek");
  const owner = await someStaff();
  const body: CreateVenue = { name: "Champions Arena", coordinates: MAADI, locationId: maadi.id };
  const created = VenueSetup.parse(await (await call(owner.id, "POST", "/venues", body)).json());
  const venueId = created.venue.id;
  return {
    marketplace,
    maadi,
    zamalek,
    owner,
    venueId,
    path: `/venues/${venueId}`,
  };
};

const detailOf = async (res: Response) => {
  expect(res.status).toBe(200);
  return StaffVenueDetail.parse(await res.json());
};

const setupOf = async (staffId: string, path: string) =>
  VenueSetup.parse(await (await call(staffId, "GET", `${path}/setup`)).json());

const eventsOf = (venueId: string, type: string) =>
  prisma.venueEvent.findMany({ where: { venueId, type }, orderBy: { id: "asc" } });

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("reading a venue for editing", () => {
  it("has everything a new draft starts with", async () => {
    const { owner, path, maadi } = await aDraft();
    const venue = await detailOf(await call(owner.id, "GET", path));
    expect(venue).toMatchObject({
      status: "DRAFT",
      phone: null,
      taxNumber: null,
      location: { id: maadi.id, coordinates: MAADI, placeId: null },
      translations: [{ language: "EN", name: "Champions Arena", description: null, address: null }],
      settings: {
        autoConfirm: true,
        minimumNotice: 60,
        paymentMode: "MANUAL",
        depositPercent: null,
        cancellationPolicy: null,
        cancellationTiers: null,
        loyalty: null,
      },
      amenities: [],
    });
  });

  it("is for members who can view the venue, and only they can change it", async () => {
    const { venueId, path } = await aDraft();
    const viewer = await someStaff();
    await addMember(venueId, viewer.id, { permissions: only({ venue: "view" }) });

    expect((await call(viewer.id, "GET", path)).status).toBe(200);
    const res = await call(viewer.id, "PATCH", path, { phone: "+20 2 2358 0000" });
    expect(res.status).toBe(403);
    expect(await problem(res)).toMatchObject({ code: "PERMISSION_DENIED", needed: "manage" });
  });
});

describe("details", () => {
  it("sets the phone (a landline is fine) and tax number, recording both values", async () => {
    const { owner, path, venueId } = await aDraft();
    const venue = await detailOf(
      await call(owner.id, "PATCH", path, { phone: "+20 2 2358 0000", taxNumber: "100-200-300" }),
    );
    expect(venue).toMatchObject({ phone: "+20223580000", taxNumber: "100-200-300" });

    const [event] = await eventsOf(venueId, "VENUE_DETAILS_CHANGED");
    expect(event).toMatchObject({
      staffId: owner.id,
      data: {
        changes: {
          phone: { previous: null, next: "+20223580000" },
          taxNumber: { previous: null, next: "100-200-300" },
        },
      },
    });
  });

  it("refuses a number that isn't one", async () => {
    const { owner, path } = await aDraft();
    const res = await call(owner.id, "PATCH", path, { phone: "0100 123 4567" });
    expect(res.status).toBe(400);
    expect(await problem(res)).toMatchObject({ code: "INVALID_PHONE_NUMBER" });
  });

  it("needs something to change", async () => {
    const { owner, path } = await aDraft();
    expect((await call(owner.id, "PATCH", path, {})).status).toBe(400);
  });

  it("records nothing when nothing changes", async () => {
    const { owner, path, venueId } = await aDraft();
    await call(owner.id, "PATCH", path, { phone: "+20 2 2358 0000" });
    await call(owner.id, "PATCH", path, { phone: "+20223580000" });
    expect(await eventsOf(venueId, "VENUE_DETAILS_CHANGED")).toHaveLength(1);
  });
});

describe("location", () => {
  it("moves the pin and the area within the marketplace", async () => {
    const { owner, path, venueId, zamalek } = await aDraft();
    const venue = await detailOf(
      await call(owner.id, "PATCH", path, {
        location: { coordinates: ZAMALEK, placeId: "ChIJ-zamalek", locationId: zamalek.id },
      }),
    );
    expect(venue.location).toEqual({
      id: zamalek.id,
      coordinates: ZAMALEK,
      placeId: "ChIJ-zamalek",
    });
    const [event] = await eventsOf(venueId, "VENUE_LOCATION_CHANGED");
    expect(event?.data).toMatchObject({
      previous: { coordinates: MAADI, placeId: null },
      next: { coordinates: ZAMALEK, placeId: "ChIJ-zamalek", locationId: zamalek.id },
    });
  });

  it("can't move to another marketplace's area, or outside the box", async () => {
    const { owner, path, maadi } = await aDraft();
    const other = await createMarketplace();
    const abroad = await prisma.location.create({
      data: { marketplaceId: other.id, locality: "DISTRICT", slug: "abroad" },
    });
    for (const location of [
      { coordinates: MAADI, placeId: null, locationId: abroad.id },
      { coordinates: { latitude: 25.2, longitude: 55.27 }, placeId: null, locationId: maadi.id },
    ]) {
      const res = await call(owner.id, "PATCH", path, { location });
      expect(res.status).toBe(422);
      expect(await problem(res)).toMatchObject({ code: "LOCATION_OUTSIDE_MARKETPLACE" });
    }
  });
});

describe("translations", () => {
  it("complete the details item together with a phone", async () => {
    const { owner, path } = await aDraft();
    await call(owner.id, "PATCH", path, { phone: "+20 100 123 4567" });
    const venue = await detailOf(
      await call(owner.id, "PUT", `${path}/translations/EN`, {
        name: "Champions Arena",
        description: "Three 5-a-side pitches and one 7-a-side, lit until 2 am.",
        address: "12 Street 9, Sarayat El Maadi",
      }),
    );
    expect(venue.translations[0]).toMatchObject({ address: "12 Street 9, Sarayat El Maadi" });

    const setup = await setupOf(owner.id, path);
    expect(setup.items.find((item) => item.key === "DETAILS")?.state).toBe("DONE");
  });

  it("can add the other language, and records each change once", async () => {
    const { owner, path, venueId } = await aDraft();
    const arabic = { name: "ملعب الأبطال", description: "ثلاثة ملاعب.", address: "شارع 9" };
    await call(owner.id, "PUT", `${path}/translations/AR`, arabic);
    const venue = await detailOf(await call(owner.id, "PUT", `${path}/translations/AR`, arabic));
    expect(venue.translations.map((t) => t.language)).toEqual(["EN", "AR"]);
    expect(await eventsOf(venueId, "VENUE_TRANSLATION_CHANGED")).toHaveLength(1);
  });
});

describe("settings", () => {
  it("count as done once a policy is chosen, showing the preset's tiers", async () => {
    const { owner, path } = await aDraft();
    const venue = await detailOf(
      await call(owner.id, "PATCH", `${path}/settings`, { cancellationPolicy: "MODERATE" }),
    );
    expect(venue.settings).toMatchObject({
      cancellationPolicy: "MODERATE",
      cancellationTiers: [
        { hours: 24, refundPercent: 100 },
        { hours: 6, refundPercent: 50 },
      ],
    });
    const setup = await setupOf(owner.id, path);
    expect(setup.items.find((item) => item.key === "SETTINGS")?.state).toBe("DONE");
  });

  it("take the owner's own rules, earliest first", async () => {
    const { owner, path } = await aDraft();
    const tiers = [
      { hours: 12, refundPercent: 100 },
      { hours: 3, refundPercent: 40 },
    ];
    const venue = await detailOf(
      await call(owner.id, "PATCH", `${path}/settings`, {
        cancellationPolicy: "CUSTOM",
        cancellationTiers: tiers,
      }),
    );
    expect(venue.settings.cancellationTiers).toEqual(tiers);

    const backwards = await call(owner.id, "PATCH", `${path}/settings`, {
      cancellationTiers: [
        { hours: 3, refundPercent: 40 },
        { hours: 12, refundPercent: 100 },
      ],
    });
    expect(backwards.status).toBe(400);
  });

  it("refuse combinations that don't fit, saying which field", async () => {
    const { owner, path } = await aDraft();
    const res = await call(owner.id, "PATCH", `${path}/settings`, { paymentMode: "DEPOSIT" });
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({ code: "INVALID_SETTINGS", field: "depositPercent" });
  });

  it("only offer the fixed notice choices", async () => {
    const { owner, path } = await aDraft();
    const ok = await call(owner.id, "PATCH", `${path}/settings`, { minimumNotice: 180 });
    expect((await detailOf(ok)).settings.minimumNotice).toBe(180);
    expect((await call(owner.id, "PATCH", `${path}/settings`, { minimumNotice: 45 })).status).toBe(
      400,
    );
  });

  it("record only what changed", async () => {
    const { owner, path, venueId } = await aDraft();
    await call(owner.id, "PATCH", `${path}/settings`, {
      paymentMode: "DEPOSIT",
      depositPercent: 30,
      loyalty: { stamps: 6, windowDays: 60 },
    });
    const [event] = await eventsOf(venueId, "VENUE_SETTINGS_CHANGED");
    expect(Object.keys((event?.data as { changes: object }).changes).sort()).toEqual([
      "depositPercent",
      "loyaltyStamps",
      "loyaltyWindow",
      "paymentMode",
    ]);
  });
});

describe("amenities", () => {
  const option = (marketplaceId: string, key: string, isActive = true) =>
    prisma.amenityOption.create({ data: { marketplaceId, key, icon: key, isActive } });

  it("are set as a whole, free or priced", async () => {
    const { owner, path, marketplace } = await aDraft();
    const [lights, parking] = [
      await option(marketplace.id, "floodlights"),
      await option(marketplace.id, "parking"),
    ];
    const amenities = [
      { optionId: lights.id, price: 15000, pricing: "PER_HOUR" },
      { optionId: parking.id, price: null, pricing: null },
    ];
    const venue = await detailOf(await call(owner.id, "PUT", `${path}/amenities`, { amenities }));
    expect(venue.amenities).toHaveLength(2);
    expect(venue.amenities).toEqual(expect.arrayContaining(amenities));

    const fewer = await detailOf(
      await call(owner.id, "PUT", `${path}/amenities`, { amenities: amenities.slice(1) }),
    );
    expect(fewer.amenities).toEqual(amenities.slice(1));

    const setup = await setupOf(owner.id, path);
    expect(setup.items.find((item) => item.key === "AMENITIES")?.state).toBe("DONE");
  });

  it("need a price and its pricing together", async () => {
    const { owner, path, marketplace } = await aDraft();
    const lights = await option(marketplace.id, "floodlights");
    const res = await call(owner.id, "PUT", `${path}/amenities`, {
      amenities: [{ optionId: lights.id, price: 15000, pricing: null }],
    });
    expect(res.status).toBe(400);
  });

  it("come from the venue's marketplace, and retired ones can be kept but not added", async () => {
    const { owner, path, marketplace } = await aDraft();
    const elsewhere = await option((await createMarketplace()).id, "parking");
    const res = await call(owner.id, "PUT", `${path}/amenities`, {
      amenities: [{ optionId: elsewhere.id, price: null, pricing: null }],
    });
    expect(res.status).toBe(422);
    expect(await problem(res)).toMatchObject({
      code: "AMENITY_NOT_AVAILABLE",
      optionIds: [elsewhere.id],
    });

    const cafe = await option(marketplace.id, "cafe");
    const showers = await option(marketplace.id, "showers", false);
    await call(owner.id, "PUT", `${path}/amenities`, {
      amenities: [{ optionId: cafe.id, price: null, pricing: null }],
    });
    await prisma.amenityOption.update({ where: { id: cafe.id }, data: { isActive: false } });
    const kept = await call(owner.id, "PUT", `${path}/amenities`, {
      amenities: [{ optionId: cafe.id, price: null, pricing: null }],
    });
    expect(kept.status).toBe(200);
    const added = await call(owner.id, "PUT", `${path}/amenities`, {
      amenities: [{ optionId: showers.id, price: null, pricing: null }],
    });
    expect(added.status).toBe(422);
  });
});

describe("what can change in each status", () => {
  const edits = (path: string, locationId: string) => ({
    listing: [
      ["PUT", `${path}/translations/EN`, { name: "Champions", description: null, address: null }],
      ["PATCH", path, { location: { coordinates: MAADI, placeId: null, locationId } }],
    ] as const,
    operations: [
      ["PATCH", path, { phone: "+20 2 2358 0000" }],
      ["PATCH", `${path}/settings`, { autoConfirm: false }],
      ["PUT", `${path}/amenities`, { amenities: [] }],
    ] as const,
  });

  it("locks everything while the venue is in review", async () => {
    const { owner, path, venueId, maadi } = await aDraft();
    await prisma.venue.update({ where: { id: venueId }, data: { status: "SUBMITTED" } });
    const { listing, operations } = edits(path, maadi.id);
    for (const [method, url, body] of [...listing, ...operations]) {
      const res = await call(owner.id, method, url, body);
      expect(res.status).toBe(409);
      expect(await problem(res)).toMatchObject({
        code: "VENUE_STATUS_CONFLICT",
        venueStatus: "SUBMITTED",
      });
    }
  });

  it("locks only the listing while it's being provisioned", async () => {
    const { owner, path, venueId, maadi } = await aDraft();
    await prisma.venue.update({ where: { id: venueId }, data: { status: "PROVISIONING" } });
    const { listing, operations } = edits(path, maadi.id);
    for (const [method, url, body] of listing) {
      expect((await call(owner.id, method, url, body)).status).toBe(409);
    }
    for (const [method, url, body] of operations) {
      expect((await call(owner.id, method, url, body)).status).toBe(200);
    }
  });

  it("allows everything once live", async () => {
    const { owner, path, venueId, maadi } = await aDraft();
    await prisma.venue.update({ where: { id: venueId }, data: { status: "LIVE" } });
    const { listing, operations } = edits(path, maadi.id);
    for (const [method, url, body] of [...listing, ...operations]) {
      expect((await call(owner.id, method, url, body)).status).toBe(200);
    }
  });
});
