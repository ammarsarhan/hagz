import { AdminVenue, page } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { router } from "@/http/router";
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
