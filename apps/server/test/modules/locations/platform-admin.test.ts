import {
  AdminAmenity,
  AdminLocation,
  AdminMarketplace,
  Amenity,
  list,
  Location,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { slugify } from "@/modules/locations/domain/slug";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createAdmin, createVenue } from "../../support/factories";
import { resetRedis } from "../../support/redis";

let cookie = "";

const request = async (method: string, path: string, body?: unknown, signedIn = true) => {
  const res = await router.request(`/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "X-Hagz-Admin": "1",
      ...(signedIn && { Cookie: cookie }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as Record<string, unknown> };
};

// A signed-in admin's cookies, through the real sign-in and authenticator steps.
const signIn = async () => {
  const { secret } = await createAdmin();
  const start = await request("POST", "/auth/admin/sessions", {
    email: "omar@hagz.app",
    password: "correct horse battery",
  });
  const done = await router.request("/v1/auth/admin/sessions/totp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({
      challengeToken: start.body.challengeToken,
      code: totpCode(secret, totpStep(new Date())),
    }),
  });
  expect(done.status).toBe(201);
  return done.headers
    .getSetCookie()
    .map((c) => c.split("; ")[0])
    .join("; ");
};

const egypt = {
  code: "EG",
  names: { en: "Egypt", ar: "مصر" },
  currency: "EGP",
  dialCode: "+20",
  timezone: "Africa/Cairo",
  taxRate: 1400,
  commissionRate: 1000,
};

const createMarketplace = async (input = egypt) => {
  const res = await request("POST", "/admin/marketplaces", input);
  expect(res.status).toBe(201);
  return AdminMarketplace.parse(res.body);
};

const addLocation = async (
  marketplaceId: string,
  en: string,
  parentId: string | null = null,
  locality = "GOVERNORATE",
) => {
  const res = await request("POST", `/admin/marketplaces/${marketplaceId}/locations`, {
    parentId,
    locality,
    names: { en, ar: `${en} (ar)` },
  });
  return res;
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  cookie = await signIn();
});

describe("slugify", () => {
  it("makes URL slugs from English names", () => {
    expect(slugify("Nasr City")).toBe("nasr-city");
    expect(slugify("  Al-Nahda (East) ")).toBe("al-nahda-east");
    expect(slugify("Héliopolis")).toBe("heliopolis");
    expect(slugify("6th of October")).toBe("6th-of-october");
  });
});

describe("admin marketplaces", () => {
  it("are only for signed-in admins", async () => {
    expect((await request("GET", "/admin/marketplaces", undefined, false)).status).toBe(401);
    expect((await request("POST", "/admin/marketplaces", egypt, false)).status).toBe(401);
  });

  it("are created hidden, with both names, and listed with what's in them", async () => {
    const created = await createMarketplace();
    expect(created).toMatchObject({
      code: "EG",
      names: { en: "Egypt", ar: "مصر" },
      taxRate: 1400,
      commissionRate: 1000,
      isActive: false,
      inUse: false,
      locationCount: 0,
    });
    // Hidden from the apps until turned on.
    const publicList = await router.request("/v1/marketplaces");
    expect(((await publicList.json()) as { data: unknown[] }).data).toEqual([]);

    await addLocation(created.id, "Cairo");
    const { body } = await request("GET", "/admin/marketplaces");
    const [listed] = list(AdminMarketplace).parse(body).data;
    expect(listed).toMatchObject({ inUse: true, locationCount: 1, venueCount: 0 });
  });

  it("refuse a taken code and invalid fields", async () => {
    await createMarketplace();
    const taken = await request("POST", "/admin/marketplaces", egypt);
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe("MARKETPLACE_EXISTS");

    for (const bad of [
      { ...egypt, code: "eg" },
      { ...egypt, code: "SA", currency: "EG" },
      { ...egypt, code: "SA", timezone: "Mars/Olympus" },
      { ...egypt, code: "SA", taxRate: 10_001 },
      { ...egypt, code: "SA", names: { en: "---", ar: "x" } },
    ]) {
      expect((await request("POST", "/admin/marketplaces", bad)).status).toBe(400);
    }
  });

  it("edit rates, names and visibility, and the code while nothing uses it", async () => {
    const { id } = await createMarketplace();
    const res = await request("PATCH", `/admin/marketplaces/${id}`, {
      code: "EE",
      taxRate: 1500,
      names: { en: "Egypt", ar: "جمهورية مصر" },
      isActive: true,
    });
    expect(res.status).toBe(200);
    expect(AdminMarketplace.parse(res.body)).toMatchObject({
      code: "EE",
      taxRate: 1500,
      names: { ar: "جمهورية مصر" },
      isActive: true,
    });
  });

  it("refuse to hide the last live marketplace, but hide one while another is live", async () => {
    const egypt = await createMarketplace();
    await request("PATCH", `/admin/marketplaces/${egypt.id}`, { isActive: true });

    const last = await request("PATCH", `/admin/marketplaces/${egypt.id}`, { isActive: false });
    expect(last.status).toBe(409);
    expect(last.body).toMatchObject({ code: "LAST_LIVE_MARKETPLACE" });

    const oman = await createMarketplace({
      ...egypt,
      code: "OM",
      names: { en: "Oman", ar: "عمان" },
      currency: "OMR",
    });
    // Hidden already: saying so again is fine.
    expect(
      (await request("PATCH", `/admin/marketplaces/${oman.id}`, { isActive: false })).status,
    ).toBe(200);
    await request("PATCH", `/admin/marketplaces/${oman.id}`, { isActive: true });
    const hidden = await request("PATCH", `/admin/marketplaces/${egypt.id}`, { isActive: false });
    expect(hidden.status).toBe(200);
    expect(hidden.body).toMatchObject({ isActive: false });
  });

  it("keep their code and currency once a location, venue or amenity uses them", async () => {
    const { id } = await createMarketplace();
    await addLocation(id, "Cairo");

    const res = await request("PATCH", `/admin/marketplaces/${id}`, {
      code: "EE",
      currency: "USD",
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "MARKETPLACE_IN_USE", fields: ["code", "currency"] });
    // Sending the same values isn't a change; other fields still edit.
    const same = await request("PATCH", `/admin/marketplaces/${id}`, {
      code: "EG",
      commissionRate: 800,
    });
    expect(same.status).toBe(200);
    expect(same.body.commissionRate).toBe(800);
  });

  it("answer 404 for one that doesn't exist", async () => {
    const res = await request("PATCH", `/admin/marketplaces/${crypto.randomUUID()}`, {
      taxRate: 0,
    });
    expect(res.status).toBe(404);
  });
});

describe("admin locations", () => {
  it("build a tree with slugs from the English names", async () => {
    const { id } = await createMarketplace();
    const cairo = AdminLocation.parse((await addLocation(id, "Cairo")).body);
    const nasr = AdminLocation.parse(
      (await addLocation(id, "Nasr City", cairo.id, "DISTRICT")).body,
    );
    expect(cairo).toMatchObject({ parentId: null, slug: "cairo", locality: "GOVERNORATE" });
    expect(nasr).toMatchObject({ parentId: cairo.id, slug: "nasr-city", locality: "DISTRICT" });

    const { body } = await request("GET", `/admin/marketplaces/${id}/locations`);
    const all = list(AdminLocation).parse(body).data;
    expect(all.map((l) => [l.slug, l.childCount])).toEqual([
      ["cairo", 1],
      ["nasr-city", 0],
    ]);
  });

  it("refuse a slug a sibling has, but allow it elsewhere in the tree", async () => {
    const { id } = await createMarketplace();
    const cairo = AdminLocation.parse((await addLocation(id, "Cairo")).body);
    const giza = AdminLocation.parse((await addLocation(id, "Giza")).body);
    await addLocation(id, "Downtown", cairo.id, "DISTRICT");

    const twin = await addLocation(id, "Downtown", cairo.id, "DISTRICT");
    expect(twin.status).toBe(409);
    expect(twin.body).toMatchObject({ code: "LOCATION_EXISTS", slug: "downtown" });
    expect((await addLocation(id, "Downtown", giza.id, "DISTRICT")).status).toBe(201);
    expect((await addLocation(id, "cairo")).status).toBe(409);
  });

  it("refuse a parent from another marketplace", async () => {
    const egyptId = (await createMarketplace()).id;
    const saudiId = (await createMarketplace({ ...egypt, code: "SA" })).id;
    const riyadh = AdminLocation.parse((await addLocation(saudiId, "Riyadh", null, "REGION")).body);

    const res = await addLocation(egyptId, "Somewhere", riyadh.id);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("PARENT_NOT_FOUND");
  });

  it("rename without changing the slug", async () => {
    const { id } = await createMarketplace();
    const cairo = AdminLocation.parse((await addLocation(id, "Cairo")).body);
    const res = await request("PATCH", `/admin/locations/${cairo.id}`, {
      names: { en: "Greater Cairo", ar: "القاهرة الكبرى" },
      locality: "CITY",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      slug: "cairo",
      locality: "CITY",
      names: { en: "Greater Cairo", ar: "القاهرة الكبرى" },
    });
  });

  it("set, move and clear an area's centre", async () => {
    const { id } = await createMarketplace();
    const smouha = { latitude: 31.2155, longitude: 29.942 };
    const created = await request("POST", `/admin/marketplaces/${id}/locations`, {
      parentId: null,
      locality: "DISTRICT",
      names: { en: "Smouha", ar: "سموحة" },
      center: smouha,
    });
    expect(created.status).toBe(201);
    const location = AdminLocation.parse(created.body);
    expect(location.center).toEqual(smouha);

    const moved = { latitude: 31.2, longitude: 29.95 };
    const res = await request("PATCH", `/admin/locations/${location.id}`, { center: moved });
    expect(AdminLocation.parse(res.body).center).toEqual(moved);
    const { body } = await request("GET", `/admin/marketplaces/${id}/locations`);
    expect(list(AdminLocation).parse(body).data[0]?.center).toEqual(moved);

    // Renaming leaves it alone; null clears it.
    const renamed = await request("PATCH", `/admin/locations/${location.id}`, {
      names: { en: "Smouha", ar: "سموحه" },
    });
    expect(AdminLocation.parse(renamed.body).center).toEqual(moved);
    const cleared = await request("PATCH", `/admin/locations/${location.id}`, { center: null });
    expect(AdminLocation.parse(cleared.body).center).toBeNull();
  });

  it("delete only while nothing is under them or in them", async () => {
    const { id } = await createMarketplace();
    const cairo = AdminLocation.parse((await addLocation(id, "Cairo")).body);
    const nasr = AdminLocation.parse(
      (await addLocation(id, "Nasr City", cairo.id, "DISTRICT")).body,
    );

    const parent = await request("DELETE", `/admin/locations/${cairo.id}`);
    expect(parent.status).toBe(409);
    expect(parent.body.code).toBe("LOCATION_IN_USE");

    // A venue in a location keeps it too.
    const venue = await createVenue(id);
    const withVenue = await request("DELETE", `/admin/locations/${venue.locationId}`);
    expect(withVenue.status).toBe(409);

    expect((await request("DELETE", `/admin/locations/${nasr.id}`)).status).toBe(204);
    expect((await request("DELETE", `/admin/locations/${cairo.id}`)).status).toBe(204);
    expect((await request("DELETE", `/admin/locations/${cairo.id}`)).status).toBe(404);
  });
});

describe("admin amenities", () => {
  const addAmenity = (marketplaceId: string, key: string, icon = "other") =>
    request("POST", `/admin/marketplaces/${marketplaceId}/amenities`, {
      key,
      names: { en: key, ar: `${key} (ar)` },
      icon,
    });

  it("are created per marketplace with a unique key, then renamed and turned off", async () => {
    const { id } = await createMarketplace();
    const created = AdminAmenity.parse((await addAmenity(id, "parking")).body);
    expect(created).toMatchObject({ key: "parking", isActive: true, venueCount: 0 });

    const twin = await addAmenity(id, "parking");
    expect(twin.status).toBe(409);
    expect(twin.body.code).toBe("AMENITY_EXISTS");
    expect((await addAmenity(id, "Parking Lot")).status).toBe(400);

    const res = await request("PATCH", `/admin/amenities/${created.id}`, {
      isActive: false,
      names: { en: "Parking", ar: "موقف سيارات" },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ key: "parking", isActive: false, names: { en: "Parking" } });
  });

  it("show one of Hagz's own icons, which can change", async () => {
    const { id } = await createMarketplace();
    const created = AdminAmenity.parse((await addAmenity(id, "parking", "parking")).body);
    expect(created.icon).toBe("parking");

    // Only names from the list: not an icon library's, and not made up.
    expect((await addAmenity(id, "showers", "IconBath")).status).toBe(400);
    expect((await addAmenity(id, "showers", "bath")).status).toBe(400);
    const missing = await request("POST", `/admin/marketplaces/${id}/amenities`, {
      key: "showers",
      names: { en: "Showers", ar: "دشات" },
    });
    expect(missing.status).toBe(400);

    const changed = await request("PATCH", `/admin/amenities/${created.id}`, {
      icon: "bike_parking",
    });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ icon: "bike_parking", isActive: true });
    const wrong = await request("PATCH", `/admin/amenities/${created.id}`, { icon: "bike" });
    expect(wrong.status).toBe(400);

    // Turning it off leaves the icon as it was.
    const off = await request("PATCH", `/admin/amenities/${created.id}`, { isActive: false });
    expect(off.body).toMatchObject({ icon: "bike_parking", isActive: false });
  });

  it("delete only while no venue offers them", async () => {
    const { id } = await createMarketplace();
    const parking = AdminAmenity.parse((await addAmenity(id, "parking")).body);
    const showers = AdminAmenity.parse((await addAmenity(id, "showers")).body);
    const venue = await createVenue(id);
    await prisma.venueAmenity.create({
      data: { venueId: venue.id, optionId: parking.id, marketplaceId: id },
    });

    const used = await request("DELETE", `/admin/amenities/${parking.id}`);
    expect(used.status).toBe(409);
    expect(used.body.code).toBe("AMENITY_IN_USE");
    expect((await request("DELETE", `/admin/amenities/${showers.id}`)).status).toBe(204);

    const { body } = await request("GET", `/admin/marketplaces/${id}/amenities`);
    expect(list(AdminAmenity).parse(body).data).toEqual([
      expect.objectContaining({ key: "parking", venueCount: 1 }),
    ]);
  });
});

describe("public reference data", () => {
  it("lists an active marketplace's locations and active amenities in the request's language", async () => {
    const { id } = await createMarketplace();
    await request("PATCH", `/admin/marketplaces/${id}`, { isActive: true });
    const cairo = AdminLocation.parse((await addLocation(id, "Cairo")).body);
    await addLocation(id, "Nasr City", cairo.id, "DISTRICT");
    const parking = AdminAmenity.parse(
      (
        await request("POST", `/admin/marketplaces/${id}/amenities`, {
          key: "parking",
          names: { en: "Parking", ar: "موقف سيارات" },
          icon: "parking",
        })
      ).body,
    );
    const cafe = AdminAmenity.parse(
      (
        await request("POST", `/admin/marketplaces/${id}/amenities`, {
          key: "cafe",
          names: { en: "Café", ar: "كافيه" },
          icon: "cafe",
        })
      ).body,
    );
    await request("PATCH", `/admin/amenities/${cafe.id}`, { isActive: false });

    const locations = list(Location).parse(
      await (await router.request("/v1/marketplaces/eg/locations")).json(),
    ).data;
    expect(locations.map((l) => [l.slug, l.name, l.parentId])).toEqual([
      ["cairo", "Cairo (ar)", null],
      ["nasr-city", "Nasr City (ar)", cairo.id],
    ]);

    const amenities = list(Amenity).parse(
      await (
        await router.request("/v1/marketplaces/EG/amenities", {
          headers: { "Accept-Language": "en" },
        })
      ).json(),
    ).data;
    expect(amenities).toEqual([
      { id: parking.id, key: "parking", name: "Parking", icon: "parking" },
    ]);
  });

  it("hides marketplaces that aren't on", async () => {
    await createMarketplace();
    expect((await router.request("/v1/marketplaces/EG/locations")).status).toBe(404);
    expect((await router.request("/v1/marketplaces/EG/amenities")).status).toBe(404);
  });
});
