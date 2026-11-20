import {
  NEXT_TIMES,
  type VenueFreeHours,
  type VenueFreeHoursQuery,
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

// What a search asks of a ground and a venue, besides where and when.
type Filters = Pick<
  VenueSearchQuery,
  | "sport"
  | "size"
  | "surface"
  | "setting"
  | "grounds"
  | "amenities"
  | "rating"
  | "instant"
  | "payment"
  | "flexible"
  | "loyalty"
>;

// A ground's filters on the ground aliased `g`: its sport, size, surface and setting.
const groundFilters = (query: Filters, g: string) => {
  const ground = Prisma.raw(g);
  const parts: Prisma.Sql[] = [];
  if (query.sport) parts.push(Prisma.sql`AND ${ground}.sport = ${query.sport}::"GroundSport"`);
  if (query.size) parts.push(Prisma.sql`AND ${ground}.size = ${query.size}::"GroundSize"`);
  if (query.surface) {
    const surfaces = query.surface.split(",");
    parts.push(Prisma.sql`AND ${ground}.surface = ANY(${surfaces}::"GroundSurface"[])`);
  }
  if (query.setting) {
    const settings = query.setting.split(",");
    parts.push(Prisma.sql`AND ${ground}.environment = ANY(${settings}::"GroundEnvironment"[])`);
  }
  return parts.length > 0 ? Prisma.join(parts, " ") : Prisma.empty;
};

// The venue's own filters on "Venue" v: its rating, how booking works there (its settings), every
// amenity asked for, and enough grounds matching the ground filters.
const venueFilters = (query: Filters) => {
  const parts: Prisma.Sql[] = [];
  if (query.rating !== undefined) {
    parts.push(Prisma.sql`AND v."averageRating" >= ${query.rating}`);
  }
  const settings: Prisma.Sql[] = [];
  if (query.instant === "true") settings.push(Prisma.sql`AND vs."autoConfirm"`);
  if (query.payment === "CASH") {
    settings.push(Prisma.sql`AND vs."paymentMode"::text IN ('MANUAL', 'DEPOSIT')`);
  }
  if (query.payment === "ONLINE") {
    settings.push(Prisma.sql`AND vs."paymentMode"::text IN ('DEPOSIT', 'PLATFORM')`);
  }
  if (query.flexible === "true") {
    // Everything back up to 24 hours before (or later): the flexible and moderate presets, or the
    // venue's own rules with such a tier.
    settings.push(Prisma.sql`AND (
      vs."cancellationPolicy"::text IN ('FLEXIBLE', 'MODERATE')
      OR (vs."cancellationPolicy"::text = 'CUSTOM' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(vs."cancellationTiers") tier
        WHERE (tier->>'refundPercent')::int = 100 AND (tier->>'hours')::int <= 24)))`);
  }
  if (query.loyalty === "true") settings.push(Prisma.sql`AND vs."loyaltyStamps" IS NOT NULL`);
  if (settings.length > 0) {
    parts.push(Prisma.sql`AND EXISTS (
      SELECT 1 FROM "VenueSettings" vs WHERE vs."venueId" = v.id ${Prisma.join(settings, " ")})`);
  }
  for (const option of query.amenities?.split(",") ?? []) {
    parts.push(Prisma.sql`AND EXISTS (
      SELECT 1 FROM "VenueAmenity" a WHERE a."venueId" = v.id AND a."optionId" = ${option}::uuid)`);
  }
  if (query.grounds !== undefined) {
    parts.push(Prisma.sql`AND (
      SELECT count(*) FROM "Ground" g2
      WHERE g2."venueId" = v.id AND g2.status = 'ACTIVE' ${groundFilters(query, "g2")}) >= ${query.grounds}`);
  }
  return parts.length > 0 ? Prisma.join(parts, " ") : Prisma.empty;
};

// The search's where and what, as SQL pieces over "Venue" v and "Ground" g: an area and everything
// under it, near a point (within the radius), part of the name in either language, and the ground
// and venue filters. Shared by the search and the free hours, so the timeline counts what the
// search finds.
const filtersFor = (
  query: Filters & {
    area?: string;
    latitude?: number;
    longitude?: number;
    radius: number;
    q?: string;
  },
) => {
  const point =
    query.latitude !== undefined && query.longitude !== undefined
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography`
      : null;
  const typed = query.q ? foldName(query.q) : "";
  return {
    point,
    area: query.area
      ? Prisma.sql`AND v."locationId" IN (
          WITH RECURSIVE tree AS (
            SELECT id FROM "Location" WHERE id = ${query.area}::uuid
            UNION ALL
            SELECT l.id FROM "Location" l JOIN tree ON l."parentId" = tree.id
          )
          SELECT id FROM tree)`
      : Prisma.empty,
    near: point
      ? Prisma.sql`AND ST_DWithin(v.coordinates, ${point}, ${query.radius * 1000})`
      : Prisma.empty,
    name: typed
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "VenueTranslation" t
          WHERE t."venueId" = v.id
            AND ${foldNameSql(Prisma.sql`t.name`)} LIKE ${`%${likeLiteral(typed)}%`})`
      : Prisma.empty,
    venue: venueFilters(query),
    ground: groundFilters(query, "g"),
  };
};

const activeMarketplace = async (code: string) => {
  const marketplace = await prisma.marketplace.findFirst({
    where: { code: code.toUpperCase(), isActive: true },
    select: { id: true, timezone: true, currency: true },
  });
  if (!marketplace) throw marketplaceNotFound();
  return marketplace;
};

// How many venues have a ground free to start each hour of a day (the When sheet's timeline): a
// free slot on an active ground of the sport and size asked for, after the venue's notice. One
// slot is enough to count: the hour's bar says something can start then, not for how long.
export const freeHours = async (
  query: VenueFreeHoursQuery,
  clock: Clock = systemClock,
): Promise<VenueFreeHours> => {
  const { id: marketplaceId, timezone } = await activeMarketplace(query.marketplace);
  const now = clock.now();
  const [day] = await prisma.$queryRaw<{ date: string; from: Date; to: Date }[]>`
    WITH d AS (
      SELECT coalesce(${query.date ?? null}::date, (${now}::timestamptz AT TIME ZONE ${timezone})::date) AS day
    )
    SELECT day::text AS date,
           (day::timestamp AT TIME ZONE ${timezone}) AS "from",
           ((day + 1)::timestamp AT TIME ZONE ${timezone}) AS "to"
    FROM d`;
  if (!day) throw new Error("Postgres returned no day.");
  const { area, near, name, venue, ground } = filtersFor(query);
  // The price range, on the hour's own slot.
  const price = Prisma.sql`${query.priceMin !== undefined ? Prisma.sql`AND s.price >= ${query.priceMin}` : Prisma.empty} ${
    query.priceMax !== undefined ? Prisma.sql`AND s.price <= ${query.priceMax}` : Prisma.empty
  }`;
  const rows = await prisma.$queryRaw<{ hour: number; venues: number }[]>`
    SELECT extract(hour FROM (s."startsAt" AT TIME ZONE ${timezone}))::int AS hour,
           count(DISTINCT s."venueId")::int AS venues
    FROM "Venue" v
    JOIN "GroundSlot" s ON s."venueId" = v.id
    JOIN "Ground" g ON g.id = s."groundId" AND g.status = 'ACTIVE' ${ground}
    LEFT JOIN "VenueSettings" st ON st."venueId" = v.id
    WHERE v.status = 'LIVE' AND v."marketplaceId" = ${marketplaceId}::uuid
      ${area} ${near} ${name} ${venue}
      AND s.status = 'AVAILABLE' ${price}
      AND s."startsAt" >= ${day.from} AND s."startsAt" < ${day.to}
      AND s."startsAt" >= ${now}::timestamptz + make_interval(mins => coalesce(st."minimumNotice", 60))
    GROUP BY 1`;
  const byHour = new Map(rows.map((row) => [row.hour, row.venues]));
  return {
    date: day.date,
    timezone,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, venues: byHour.get(hour) ?? 0 })),
  };
};

export const searchVenues = async (
  query: VenueSearchQuery,
  language: Language,
  clock: Clock = systemClock,
): Promise<VenueSearchResults> => {
  const marketplace = await activeMarketplace(query.marketplace);
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

  const { point, area, near, name, venue, ground } = filtersFor(query);
  const sort = query.sort ?? (point ? "DISTANCE" : "RATING");
  const seconds = query.hours * 3600;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const distance = point
    ? Prisma.sql`round(ST_Distance(v.coordinates, ${point}))::int`
    : Prisma.sql`NULL::int`;
  // Ascending in all: nearest first, best rated first (the unrated after everyone), or (from the
  // venue's bookable starts, below) the cheapest hour or the earliest start first.
  const fromStarts = sort === "PRICE" || sort === "SOONEST";
  const key =
    sort === "DISTANCE"
      ? Prisma.sql`ST_Distance(v.coordinates, ${point ?? Prisma.sql`NULL`})::float8`
      : sort === "RATING"
        ? Prisma.sql`coalesce(-v."averageRating"::float8, 1)`
        : Prisma.sql`NULL::float8`;
  // The earliest start is the first by time, so its read stops there; the cheapest needs them all.
  const startKey =
    sort === "PRICE"
      ? Prisma.sql`min(free.price)::float8 / ${query.hours}`
      : Prisma.sql`extract(epoch FROM s."startsAt")::float8`;
  const startLimit = sort === "SOONEST" ? Prisma.sql`ORDER BY s."startsAt" LIMIT 1` : Prisma.empty;
  // The price range, per hour, on the whole game's price.
  const price = Prisma.sql`${
    query.priceMin !== undefined
      ? Prisma.sql`AND free.price >= ${query.priceMin * query.hours}`
      : Prisma.empty
  } ${query.priceMax !== undefined ? Prisma.sql`AND free.price <= ${query.priceMax * query.hours}` : Prisma.empty}`;
  const after = cursor
    ? Prisma.sql`WHERE (r.key, r.id) > (${cursor.key}::float8, ${cursor.id}::uuid)`
    : Prisma.empty;

  // A venue's bookable starts in the window: each free slot on an active ground (of the sport and
  // size asked for), after the venue's notice, whose ground's free slots fill the length from it.
  // The inner read is bounded on startsAt both ways, so the (groundId, startsAt) index reads only
  // the few slots in the length, not every slot to the horizon.
  const startsOf = (venue: Prisma.Sql) => Prisma.sql`
    "GroundSlot" s
    JOIN "Ground" g ON g.id = s."groundId" AND g.status = 'ACTIVE' ${ground}
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
      AND free.seconds = ${seconds}
      ${price}`;
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
        ${area} ${near} ${name} ${venue}
    ),
    ranked AS (
      ${
        fromStarts
          ? // Keyed by the venue's cheapest or earliest bookable start; none means no match.
            Prisma.sql`SELECT c.id, c.distance, m.key, c.latitude, c.longitude, count(*) OVER ()::int AS total
              FROM candidates c
              CROSS JOIN LATERAL (
                SELECT ${startKey} AS key FROM ${startsOf(Prisma.raw("c.id"))} ${atStart} ${startLimit}
              ) m
              WHERE m.key IS NOT NULL`
          : Prisma.sql`SELECT c.*, count(*) OVER ()::int AS total
              FROM candidates c
              WHERE EXISTS (SELECT 1 FROM ${startsOf(Prisma.raw("c.id"))} ${atStart})`
      }
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
