import { Area, list } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { router } from "@/http/router";
import { fold } from "@/modules/locations/application/areas";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createMarketplace } from "../../support/factories";

const get = (path: string, language = "en") =>
  router.request(`/v1/marketplaces/EG${path}`, { headers: { "Accept-Language": language } });

const areas = async (query: string, language = "en") => {
  const res = await get(`/areas${query}`, language);
  expect(res.status).toBe(200);
  return list(Area).parse(await res.json()).data;
};

const nearest = async (latitude: number, longitude: number) => {
  const res = await get(`/areas/nearest?latitude=${latitude}&longitude=${longitude}`);
  expect(res.status).toBe(200);
  return z.object({ area: Area.nullable() }).parse(await res.json()).area;
};

const place = async (
  marketplaceId: string,
  parentId: string | null,
  slug: string,
  [en, ar]: [string, string],
  center?: [number, number],
) => {
  const { id } = await prisma.location.create({
    data: {
      marketplaceId,
      parentId,
      slug,
      locality: parentId ? "DISTRICT" : "GOVERNORATE",
      translations: {
        create: [
          { language: "EN", name: en },
          { language: "AR", name: ar },
        ],
      },
    },
  });
  if (center) {
    await prisma.$executeRaw`
      UPDATE "Location" SET center = ST_SetSRID(ST_MakePoint(${center[1]}, ${center[0]}), 4326)::geography
      WHERE id = ${id}::uuid`;
  }
  return id;
};

// Smouha Sporting Club: Google calls this "Sidi Gaber", which is what the old matching picked.
const SMOUHA_CLUB = { latitude: 31.2156, longitude: 29.9553 };

beforeEach(async () => {
  await resetDatabase();
  const { id } = await createMarketplace({ code: "EG" });
  const alexandria = await place(id, null, "alexandria", ["Alexandria", "الإسكندرية"]);
  await place(id, alexandria, "smouha", ["Smouha", "سموحة"], [31.2155, 29.942]);
  await place(id, alexandria, "sidi-gaber", ["Sidi Gaber", "سيدي جابر"], [31.2213, 29.9379]);
  await place(id, alexandria, "agami", ["Agami", "العجمي"], [31.0988, 29.7667]);
  // No centre yet: found by name, never suggested.
  await place(id, alexandria, "miami", ["Miami", "ميامي"]);
  // A governorate with nothing under it is itself where a venue goes.
  await place(id, null, "matrouh", ["Matrouh", "مطروح"], [29.5696, 26.4194]);
  await createMarketplace({ code: "SA" }).then(({ id: saudi }) =>
    place(saudi, null, "riyadh", ["Riyadh", "الرياض"], [24.7136, 46.6753]),
  );
});

describe("suggesting an area for a pin", () => {
  it("picks the nearest centre, so a pin in Smouha is Smouha", async () => {
    expect(await nearest(SMOUHA_CLUB.latitude, SMOUHA_CLUB.longitude)).toMatchObject({
      name: "Smouha",
      within: "Alexandria",
    });
  });

  it("suggests nothing far from every centre", async () => {
    // Mid-desert, 200 km from Matrouh's centre.
    expect(await nearest(28, 28)).toBeNull();
  });

  it("needs a point", async () => {
    expect((await get("/areas/nearest?latitude=31.2")).status).toBe(400);
  });
});

describe("searching areas", () => {
  it("offers only places a venue can be in, nearest first, centreless last", async () => {
    const found = await areas(
      `?latitude=${SMOUHA_CLUB.latitude}&longitude=${SMOUHA_CLUB.longitude}`,
    );
    expect(found.map((area) => area.name)).toEqual([
      "Smouha",
      "Sidi Gaber",
      "Agami",
      "Matrouh",
      "Miami",
    ]);
    expect(found[0]?.distance).toBeGreaterThan(0);
    expect(found[0]?.distance).toBeLessThan(2000);
    expect(found.at(-1)?.distance).toBeNull();
  });

  it("goes by name without a point, in the requested language", async () => {
    const found = await areas("", "ar");
    expect(found.map((area) => area.name)).toEqual([
      "العجمي",
      "سموحة",
      "سيدي جابر",
      "مطروح",
      "ميامي",
    ]);
    expect(found.every((area) => area.distance === null)).toBe(true);
  });

  it("matches either language and the usual spellings", async () => {
    for (const q of ["smouha", "SMOU", "سموحه", "سموحة"]) {
      expect((await areas(`?q=${encodeURIComponent(q)}`)).map((area) => area.name)).toEqual([
        "Smouha",
      ]);
    }
    expect((await areas("?q=sidigaber")).map((area) => area.name)).toEqual(["Sidi Gaber"]);
    // A wildcard is a character, not a wildcard.
    expect(await areas("?q=%25")).toEqual([]);
  });

  it("keeps to the marketplace and the limit", async () => {
    expect((await areas("?q=riyadh")).length).toBe(0);
    expect((await areas("?limit=2")).length).toBe(2);
  });

  it("needs latitude and longitude together", async () => {
    expect((await get("/areas?latitude=31.2")).status).toBe(400);
  });
});

describe("folding names", () => {
  it("ignores case, diacritics, spaces and the letters Arabic writes either way", () => {
    expect(fold("Sidi Gaber")).toBe("sidigaber");
    expect(fold("الإسكندرية")).toBe(fold("الاسكندريه"));
    expect(fold("سَمُوحَة")).toBe("سموحه");
  });
});
