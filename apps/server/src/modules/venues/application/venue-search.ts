import {
  NEXT_TIMES,
  type VenueCard,
  type VenueSearchQuery,
  type VenueSearchResults,
} from "@hagz/contracts";
import { Prisma } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { storage } from "@/platform/storage/storage";
import { foldName, foldNameSql, likeLiteral } from "@/platform/text/fold";
import { nameIn, placeOf } from "../domain/names";

// Search, first slice (PR 3.3): live venues by where (an area and everything under it, near a
// point, or part of a name) with a ground free when asked (a start time, or any time that day) for
// the whole length, as cards with their next free times. One query finds, orders and counts the
// venues and reads the page's free times; a second reads the page's names, areas and covers.
//
// A start counts when its slot is AVAILABLE, on an ACTIVE ground (of the sport and size asked
// for), after the venue's minimum notice, and the ground's free slots from it fill the length:
// slots never overlap (GroundSlot_no_overlap), so free time adding up to the length inside
// [start, start + length) means it's free all through. Paused venues aren't searched: they take no
// bookings. Pages are a keyset on (sort key, id).

const marketplaceNotFound = () =>
  new AppError({
    code: "MARKETPLACE_NOT_FOUND",
    status: 404,
    detail: "There's no such marketplace.",
  });

const invalidCursor = () =>
  new AppError({
    code: "INVALID_CURSOR",
    status: 400,
    detail: "That page link has expired. Search again.",
  });

interface Cursor {
  key: number;
  id: string;
}

const encodeCursor = (cursor: Cursor) =>
  Buffer.from(JSON.stringify([cursor.key, cursor.id])).toString("base64url");

const decodeCursor = (text: string): Cursor => {
  try {
    const [key, id] = JSON.parse(Buffer.from(text, "base64url").toString()) as unknown[];
    if (typeof key !== "number" || typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) {
      throw new Error("Malformed cursor.");
    }
    return { key, id };
  } catch {
    throw invalidCursor();
  }
};

interface Row {
  id: string;
  distance: number | null;
  key: number;
  next: { startsAt: string; grounds: number }[];
  cheapest: number;
  // Every venue found, not just this page's.
  total: number;
  latitude: number | null;
  longitude: number | null;
}

export const searchVenues = async (
  query: VenueSearchQuery,
  language: Language,
  clock: Clock = systemClock,
): Promise<VenueSearchResults> => {
  const marketplace = await prisma.marketplace.findFirst({
    where: { code: query.marketplace.toUpperCase(), isActive: true },
    select: { id: true, timezone: true, currency: true },
  });
  if (!marketplace) throw marketplaceNotFound();
  const { timezone, currency } = marketplace;
  const now = clock.now();

  // The day and the window, in the marketplace's time: from the start asked for (or the day's
  // first minute) to the end of the day.
  const [window] = await prisma.$queryRaw<{ date: string; from: Date; to: Date }[]>`
    WITH d AS (
      SELECT coalesce(${query.date ?? null}::date, (${now}::timestamptz AT TIME ZONE ${timezone})::date) AS day
    )
    SELECT day::text AS date,
           ((day + coalesce(${query.start ?? null}::time, '00:00'::time))::timestamp AT TIME ZONE ${timezone}) AS "from",
           ((day + 1)::timestamp AT TIME ZONE ${timezone}) AS "to"
    FROM d`;
  if (!window) throw new Error("Postgres returned no search window.");

  const point =
    query.latitude !== undefined && query.longitude !== undefined
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography`
      : null;
  const sort = query.sort ?? (point ? "DISTANCE" : "RATING");
  const seconds = query.hours * 3600;
  const typed = query.q ? foldName(query.q) : "";
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const area = query.area
    ? Prisma.sql`AND v."locationId" IN (
        WITH RECURSIVE tree AS (
          SELECT id FROM "Location" WHERE id = ${query.area}::uuid
          UNION ALL
          SELECT l.id FROM "Location" l JOIN tree ON l."parentId" = tree.id
        )
        SELECT id FROM tree)`
    : Prisma.empty;
  const near = point
    ? Prisma.sql`AND ST_DWithin(v.coordinates, ${point}, ${query.radius * 1000})`
    : Prisma.empty;
  const name = typed
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "VenueTranslation" t
        WHERE t."venueId" = v.id
          AND ${foldNameSql(Prisma.sql`t.name`)} LIKE ${`%${likeLiteral(typed)}%`})`
    : Prisma.empty;
  const sport = query.sport
    ? Prisma.sql`AND g.sport = ${query.sport}::"GroundSport"`
    : Prisma.empty;
  const size = query.size ? Prisma.sql`AND g.size = ${query.size}::"GroundSize"` : Prisma.empty;
  const distance = point
    ? Prisma.sql`round(ST_Distance(v.coordinates, ${point}))::int`
    : Prisma.sql`NULL::int`;
  // Ascending in both: nearest first, or best rated first with the unrated after everyone.
  const key =
    sort === "DISTANCE"
      ? Prisma.sql`ST_Distance(v.coordinates, ${point ?? Prisma.sql`NULL`})::float8`
      : Prisma.sql`coalesce(-v."averageRating"::float8, 1)`;
  const after = cursor
    ? Prisma.sql`WHERE (r.key, r.id) > (${cursor.key}::float8, ${cursor.id}::uuid)`
    : Prisma.empty;

  // A venue's bookable starts in the window: each free slot on an active ground (of the sport and
  // size asked for), after the venue's notice, whose ground's free slots fill the length from it.
  // The inner read is bounded on startsAt both ways, so the (groundId, startsAt) index reads only
  // the few slots in the length, not every slot to the horizon.
  const startsOf = (venue: Prisma.Sql) => Prisma.sql`
    "GroundSlot" s
    JOIN "Ground" g ON g.id = s."groundId" AND g.status = 'ACTIVE' ${sport} ${size}
    LEFT JOIN "VenueSettings" st ON st."venueId" = s."venueId"
    CROSS JOIN LATERAL (
      SELECT sum(extract(epoch FROM x."endsAt" - x."startsAt")) AS seconds, sum(x.price) AS price
      FROM "GroundSlot" x
      WHERE x."groundId" = s."groundId" AND x.status = 'AVAILABLE'
        AND x."startsAt" >= s."startsAt"
        AND x."startsAt" < s."startsAt" + make_interval(secs => ${seconds})
        AND x."endsAt" <= s."startsAt" + make_interval(secs => ${seconds})
    ) free
    WHERE s."venueId" = ${venue}
      AND s.status = 'AVAILABLE'
      AND s."startsAt" >= ${window.from} AND s."startsAt" < ${window.to}
      AND s."startsAt" >= ${now}::timestamptz + make_interval(mins => coalesce(st."minimumNotice", 60))
      AND free.seconds = ${seconds}`;
  // With a start asked for, the venue must have a ground free from exactly then.
  const atStart = query.start ? Prisma.sql`AND s."startsAt" = ${window.from}` : Prisma.empty;

  // Two stages, so the cost follows the page and not the whole country: first which venues match
  // (EXISTS stops at the first bookable start), their order and how many; then the next free
  // times and the cheapest price for the page's venues only.
  const rows = await prisma.$queryRaw<Row[]>`
    WITH candidates AS (
      SELECT v.id, ${distance} AS distance, ${key} AS key,
             ST_Y(v.coordinates::geometry) AS latitude, ST_X(v.coordinates::geometry) AS longitude
      FROM "Venue" v
      WHERE v.status = 'LIVE' AND v."marketplaceId" = ${marketplace.id}::uuid
        ${area} ${near} ${name}
    ),
    ranked AS (
      SELECT c.*, count(*) OVER ()::int AS total
      FROM candidates c
      WHERE EXISTS (SELECT 1 FROM ${startsOf(Prisma.raw("c.id"))} ${atStart})
    ),
    page AS (
      SELECT r.* FROM ranked r
      ${after}
      ORDER BY r.key, r.id
      LIMIT ${query.limit + 1}
    )
    SELECT p.id, p.distance, p.key, p.total, p.latitude, p.longitude, d.next, d.cheapest
    FROM page p
    CROSS JOIN LATERAL (
      SELECT json_agg(json_build_object('startsAt', t."startsAt", 'grounds', t.grounds)
               ORDER BY t."startsAt") FILTER (WHERE t.n <= ${NEXT_TIMES}) AS next,
             min(t.price)::int AS cheapest
      FROM (
        SELECT s."startsAt", count(DISTINCT s."groundId")::int AS grounds, min(free.price) AS price,
               row_number() OVER (ORDER BY s."startsAt") AS n
        FROM ${startsOf(Prisma.raw("p.id"))}
        GROUP BY s."startsAt"
      ) t
    ) d
    ORDER BY p.key, p.id`;

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  const nextCursor =
    rows.length > query.limit && last ? encodeCursor({ key: last.key, id: last.id }) : null;

  return {
    date: window.date,
    timezone,
    currency,
    // Counted before the cursor: on a later page the rows left are fewer, so ask the first page.
    total: query.cursor ? null : (rows[0]?.total ?? 0),
    data: await cards(page, query.hours, language),
    nextCursor,
  };
};

const names = { translations: { select: { language: true, name: true } } } as const;

// The page's venues as cards, in the order found.
const cards = async (rows: Row[], hours: number, language: Language): Promise<VenueCard[]> => {
  const venues = await prisma.venue.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    select: {
      id: true,
      slug: true,
      averageRating: true,
      reviewCount: true,
      ...names,
      location: { select: { ...names, parent: { select: names } } },
      media: {
        where: { type: "IMAGE", status: "READY" },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        take: 1,
        select: { key: true },
      },
      grounds: { where: { status: "ACTIVE" }, select: { sport: true }, distinct: ["sport"] },
    },
  });
  const byId = new Map(venues.map((venue) => [venue.id, venue]));
  return rows.flatMap((row) => {
    const venue = byId.get(row.id);
    if (!venue) return [];
    const cover = venue.media[0];
    return [
      {
        id: venue.id,
        slug: venue.slug,
        name: nameIn(venue.translations, language),
        area: placeOf(venue.location, language),
        cover: cover ? { url: storage.publicUrl(cover.key) } : null,
        rating: {
          average: venue.averageRating === null ? null : venue.averageRating.toNumber(),
          count: venue.reviewCount,
        },
        coordinates:
          row.latitude === null || row.longitude === null
            ? null
            : { latitude: row.latitude, longitude: row.longitude },
        distance: row.distance,
        sports: venue.grounds.map((ground) => ground.sport),
        // The cheapest of the free times' totals, per hour.
        priceFrom: Math.round(row.cheapest / hours),
        nextTimes: row.next.map((time) => ({
          startsAt: new Date(time.startsAt).toISOString(),
          grounds: time.grounds,
        })),
      },
    ];
  });
};
