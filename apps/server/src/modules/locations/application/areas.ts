import type { Area, AreaQuery, NearestAreaQuery } from "@hagz/contracts";
import { Prisma } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { prisma } from "@/platform/db/prisma";
import { activeMarketplaceId } from "./public-reference";
import { nameIn } from "./names";

// Finding the area a venue is in, for the venue creation flow. Only leaves are offered: a venue
// belongs to a neighbourhood or a city, not to a governorate with areas inside it.
//
// Suggesting one goes by distance to each area's centre, not by Google's address: in Egypt Google
// names police districts (a pin in Smouha comes back as "Sidi Gaber"), not the areas people say.

// Further than this from every centre, nothing is suggested and the owner picks or asks for one.
// Neighbourhood centres are 1–3 km apart in the cities, so this is generous there and still says
// "not near anything we cover" out in the governorates.
export const SUGGEST_WITHIN_METRES = 8000;

// Same place, different spelling: case, Arabic diacritics and the interchangeable letters (أ/ا,
// ى/ي, ة/ه), spaces, hyphens and apostrophes. Done the same way on both sides, here for the query
// and in SQL for the names, so "smouha", "Smouha" and "سموحه" all find سموحة.
const IGNORED = "[\\u064B-\\u0652\\u0670\\s'’.-]";
const LETTERS: [string, string][] = [
  ["أ", "ا"],
  ["إ", "ا"],
  ["آ", "ا"],
  ["ى", "ي"],
  ["ئ", "ي"],
  ["ؤ", "و"],
  ["ة", "ه"],
];
const FROM = LETTERS.map(([from]) => from).join("");
const TO = LETTERS.map(([, to]) => to).join("");

export const fold = (text: string) =>
  LETTERS.reduce(
    (folded, [from, to]) => folded.replaceAll(from, to),
    text.toLowerCase().replace(new RegExp(IGNORED, "gu"), ""),
  );

const foldSql = (column: Prisma.Sql) =>
  Prisma.sql`translate(regexp_replace(lower(${column}), ${IGNORED}, '', 'g'), ${FROM}, ${TO})`;

// % and _ are wildcards to LIKE.
const literal = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

interface Point {
  latitude: number;
  longitude: number;
}

const pointSql = ({ latitude, longitude }: Point) =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;

// The ids in order, with how far each is from the point.
const findAreas = async (
  marketplaceId: string,
  language: Language,
  { q, point, limit, within }: { q: string; point?: Point; limit: number; within?: number },
) => {
  const typed = fold(q);
  const nameMatch = typed
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "LocationTranslation" t
        WHERE t."locationId" = l.id
          AND ${foldSql(Prisma.sql`t.name`)} LIKE ${`%${literal(typed)}%`})`
    : Prisma.empty;
  const near =
    point && within !== undefined
      ? Prisma.sql`AND ST_DWithin(l.center, ${pointSql(point)}, ${within})`
      : Prisma.empty;
  const distance = point
    ? Prisma.sql`round(ST_Distance(l.center, ${pointSql(point)}))::int`
    : Prisma.sql`NULL::int`;
  // Nearest first when there's a point (the <-> ordering uses the index); areas without a centre
  // go last, by name.
  const order = point
    ? Prisma.sql`l.center IS NULL, l.center <-> ${pointSql(point)}, n.name`
    : Prisma.sql`n.name`;

  return prisma.$queryRaw<{ id: string; distance: number | null }[]>`
    SELECT l.id, ${distance} AS distance
    FROM "Location" l
    LEFT JOIN "LocationTranslation" n ON n."locationId" = l.id AND n.language = ${language}::"Language"
    WHERE l."marketplaceId" = ${marketplaceId}::uuid
      AND NOT EXISTS (SELECT 1 FROM "Location" c WHERE c."parentId" = l.id)
      ${nameMatch}
      ${near}
    ORDER BY ${order} NULLS LAST
    LIMIT ${limit}`;
};

const names = { translations: { select: { language: true, name: true } } } as const;

// Names for the ids, in the same order, with the top of each one's tree. Trees are three levels at
// most (governorate, city, district), so three parents reach the top.
const present = async (
  rows: { id: string; distance: number | null }[],
  language: Language,
): Promise<Area[]> => {
  const locations = await prisma.location.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    select: {
      id: true,
      ...names,
      parent: { select: { ...names, parent: { select: { ...names, parent: { select: names } } } } },
    },
  });
  const byId = new Map(locations.map((location) => [location.id, location]));
  return rows.flatMap((row) => {
    const location = byId.get(row.id);
    if (!location) return [];
    const top = location.parent?.parent?.parent ?? location.parent?.parent ?? location.parent;
    return [
      {
        id: location.id,
        name: nameIn(location.translations, language),
        within: top ? nameIn(top.translations, language) : null,
        distance: row.distance,
      },
    ];
  });
};

const pointOf = (query: { latitude?: number; longitude?: number }): Point | undefined =>
  query.latitude !== undefined && query.longitude !== undefined
    ? { latitude: query.latitude, longitude: query.longitude }
    : undefined;

export const searchAreas = async (
  code: string,
  query: AreaQuery,
  language: Language,
): Promise<Area[]> => {
  const marketplaceId = await activeMarketplaceId(code);
  const rows = await findAreas(marketplaceId, language, {
    q: query.q ?? "",
    point: pointOf(query),
    limit: query.limit,
  });
  return present(rows, language);
};

export const nearestArea = async (
  code: string,
  query: NearestAreaQuery,
  language: Language,
): Promise<Area | null> => {
  const marketplaceId = await activeMarketplaceId(code);
  const rows = await findAreas(marketplaceId, language, {
    q: "",
    point: query,
    limit: 1,
    within: SUGGEST_WITHIN_METRES,
  });
  return (await present(rows, language))[0] ?? null;
};
