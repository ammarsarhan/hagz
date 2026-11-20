import {
  JUST_FREED,
  MIN_REVIEWS,
  NEXT_TIMES,
  PRICE_STEP,
  SEARCH_RADIUS_KM,
  type VenueCoverage,
  type VenueCoverageQuery,
  type VenueSpread,
  type VenueSpreadQuery,
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
  next: { startsAt: string; grounds: number; justFreed: boolean }[];
  justFreed: boolean;
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
    parts.push(
      Prisma.sql`AND v."averageRating" >= ${query.rating} AND v."reviewCount" >= ${MIN_REVIEWS}`,
    );
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
// A venue's bookable starts for a search's when and ground filters: the day's window, in the
// marketplace's time, from the start asked for (or the day's first minute) to its end, and the SQL
// for the starts in it. `priced: false` leaves the price range out (for the price chart).
const bookable = async (
  query: Pick<VenueSearchQuery, "date" | "start" | "hours" | "priceMin" | "priceMax"> & Filters,
  timezone: string,
  now: Date,
  { priced = true }: { priced?: boolean } = {},
) => {
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

  const ground = groundFilters(query, "g");
  const seconds = query.hours * 3600;
  // The price range, per hour, on the whole game's price.
  const price = !priced
    ? Prisma.empty
    : Prisma.sql`${
        query.priceMin !== undefined
          ? Prisma.sql`AND free.price >= ${query.priceMin * query.hours}`
          : Prisma.empty
      } ${query.priceMax !== undefined ? Prisma.sql`AND free.price <= ${query.priceMax * query.hours}` : Prisma.empty}`;

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

  return { window, startsOf, atStart };
};

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

// Best match (docs/architecture.md, "Search ranking"): a tier from the player's own history, then a
// score in [0, 1] from closeness, rating and fit. The weights are constants, to tune on real data.
const MATCH = {
  closeness: 0.45,
  rating: 0.35,
  fit: 0.2,
  // Closeness halves about every 3.5 km from the point or the area's centre.
  closenessKm: 5,
  // A venue's rating counts as this many reviews at the marketplace's mean, plus its own.
  priorReviews: 10,
  // Free times counted for fit, at most.
  fitStarts: 12,
} as const;

export const searchVenues = async (
  query: VenueSearchQuery,
  language: Language,
  customerId: string | null = null,
  clock: Clock = systemClock,
): Promise<VenueSearchResults> => {
  const marketplace = await activeMarketplace(query.marketplace);
  const { timezone, currency } = marketplace;
  const now = clock.now();

  const { window, startsOf, atStart } = await bookable(query, timezone, now);
  const { point, area, near, name, venue } = filtersFor(query);
  const sort = query.sort ?? "BEST_MATCH";
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const distance = point
    ? Prisma.sql`round(ST_Distance(v.coordinates, ${point}))::int`
    : Prisma.sql`NULL::int`;
  // Ascending in all: nearest first, best rated first (the unrated after everyone), or (from the
  // venue's bookable starts, below) the cheapest hour, the earliest start or the best match first.
  const fromStarts = sort === "PRICE" || sort === "SOONEST";
  // Best match's closeness: from the point, or the area's centre; by name alone, the same for all.
  const centre =
    point ??
    (query.area
      ? Prisma.sql`(SELECT center FROM "Location" WHERE id = ${query.area}::uuid)`
      : null);
  const closeness = centre
    ? Prisma.sql`coalesce(exp(-ST_Distance(v.coordinates, ${centre}) / ${MATCH.closenessKm * 1000}), 0.5)`
    : Prisma.sql`0.5`;
  // The rating pulled towards the marketplace's mean by a prior of a few reviews, out of 1.
  const rating = Prisma.sql`(
    (${MATCH.priorReviews} * mean.value + coalesce(v."averageRating", 0) * v."reviewCount")
    / (${MATCH.priorReviews} + v."reviewCount") / 5.0)`;
  // The player's own venues: played at, and the loyalty card being filled or with a free booking.
  const mine = customerId
    ? Prisma.sql`SELECT vc."venueId", max(vc."bookingCount") AS played,
                        bool_or(lc.status = 'EARNED') AS earned, bool_or(lc.status = 'OPEN') AS open
                 FROM "VenueCustomer" vc
                 LEFT JOIN "LoyaltyCard" lc ON lc."customerId" = vc.id
                   AND lc.status IN ('OPEN', 'EARNED') AND lc."expiresAt" > ${now}
                 WHERE vc."customerId" = ${customerId}::uuid
                 GROUP BY vc."venueId"`
    : Prisma.sql`SELECT NULL::uuid AS "venueId", 0 AS played, false AS earned, false AS open WHERE false`;
  const key =
    sort === "DISTANCE"
      ? Prisma.sql`ST_Distance(v.coordinates, ${point ?? Prisma.sql`NULL`})::float8`
      : sort === "RATING"
        ? // Ratings from enough reviews first, best first (−5 to −1); then ratings from too few,
          // still best first (0.5 to 0.9); then the unrated (1).
          Prisma.sql`CASE
            WHEN v."reviewCount" >= ${MIN_REVIEWS} THEN -v."averageRating"::float8
            ELSE 1 - coalesce(v."averageRating"::float8, 0) / 10
          END`
        : Prisma.sql`NULL::float8`;
  // The earliest start is the first by time, so its read stops there; the cheapest needs them all.
  const startKey =
    sort === "PRICE"
      ? Prisma.sql`min(free.price)::float8 / ${query.hours}`
      : Prisma.sql`extract(epoch FROM s."startsAt")::float8`;
  const startLimit = sort === "SOONEST" ? Prisma.sql`ORDER BY s."startsAt" LIMIT 1` : Prisma.empty;
  const after = cursor
    ? Prisma.sql`WHERE (r.key, r.id) > (${cursor.key}::float8, ${cursor.id}::uuid)`
    : Prisma.empty;

  // Two stages, so the cost follows the page and not the whole country: first which venues match
  // (EXISTS stops at the first bookable start), their order and how many; then the next free
  // times and the cheapest price for the page's venues only.
  const rows = await prisma.$queryRaw<Row[]>`
    WITH mean AS (
      SELECT coalesce(sum(v."averageRating" * v."reviewCount") / nullif(sum(v."reviewCount"), 0), 4)::float8 AS value
      FROM "Venue" v WHERE v.status = 'LIVE' AND v."marketplaceId" = ${marketplace.id}::uuid
    ),
    mine AS (${mine}),
    candidates AS (
      SELECT v.id, ${distance} AS distance, ${key} AS key,
             ${closeness}::float8 AS closeness, ${rating}::float8 AS rating,
             ST_Y(v.coordinates::geometry) AS latitude, ST_X(v.coordinates::geometry) AS longitude
      FROM "Venue" v CROSS JOIN mean
      WHERE v.status = 'LIVE' AND v."marketplaceId" = ${marketplace.id}::uuid
        ${area} ${near} ${name} ${venue}
    ),
    ranked AS (
      ${
        sort === "BEST_MATCH"
          ? // Tier first (each tier 10 apart), then the score: the higher the score, the lower the key.
            // Counting up to a few free times both checks the venue matches and measures fit.
            Prisma.sql`SELECT c.id, c.distance, c.latitude, c.longitude,
                (CASE WHEN m.earned THEN 0 WHEN m.open THEN 1 WHEN m.played > 0 THEN 2
                      WHEN vs."loyaltyStamps" IS NOT NULL THEN 3 ELSE 4 END) * 10
                  + 1 - (${MATCH.closeness} * c.closeness + ${MATCH.rating} * c.rating
                         + ${MATCH.fit} * least(f.n, ${MATCH.fitStarts})::float8 / ${MATCH.fitStarts}) AS key,
                count(*) OVER ()::int AS total
              FROM candidates c
              CROSS JOIN LATERAL (
                SELECT count(*) AS n FROM (
                  SELECT 1 FROM ${startsOf(Prisma.raw("c.id"))} ${atStart} LIMIT ${MATCH.fitStarts}
                ) x
              ) f
              LEFT JOIN mine m ON m."venueId" = c.id
              LEFT JOIN "VenueSettings" vs ON vs."venueId" = c.id
              WHERE f.n > 0`
          : fromStarts
            ? // Keyed by the venue's cheapest or earliest bookable start; none means no match.
              Prisma.sql`SELECT c.id, c.distance, m.key, c.latitude, c.longitude, count(*) OVER ()::int AS total
              FROM candidates c
              CROSS JOIN LATERAL (
                SELECT ${startKey} AS key FROM ${startsOf(Prisma.raw("c.id"))} ${atStart} ${startLimit}
              ) m
              WHERE m.key IS NOT NULL`
            : Prisma.sql`SELECT c.id, c.distance, c.key, c.latitude, c.longitude, count(*) OVER ()::int AS total
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
    SELECT p.id, p.distance, p.key, p.total, p.latitude, p.longitude, d.next, d.cheapest,
           d."justFreed"
    FROM page p
    CROSS JOIN LATERAL (
      SELECT json_agg(json_build_object('startsAt', t."startsAt", 'grounds', t.grounds,
                                        'justFreed', t."justFreed")
               ORDER BY t."startsAt") FILTER (WHERE t.n <= ${NEXT_TIMES}) AS next,
             min(t.price)::int AS cheapest, coalesce(bool_or(t."justFreed"), false) AS "justFreed"
      FROM (
        SELECT s."startsAt", count(DISTINCT s."groundId")::int AS grounds, min(free.price) AS price,
               coalesce(bool_or(s."freedAt" >= ${now}::timestamptz - make_interval(hours => ${JUST_FREED.freedWithinHours})
                 AND s."startsAt" < ${now}::timestamptz + make_interval(hours => ${JUST_FREED.startsWithinHours})), false) AS "justFreed",
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
    data: await cards(page, query.hours, language, customerId, now),
    nextCursor,
  };
};

const names = { translations: { select: { language: true, name: true } } } as const;

// The page's venues as cards, in the order found.
const cards = async (
  rows: Row[],
  hours: number,
  language: Language,
  customerId: string | null,
  now: Date,
): Promise<VenueCard[]> => {
  const ids = rows.map((row) => row.id);
  // The signed-in player and these venues: saved, played at, and their loyalty card there.
  const [favorites, customers] = customerId
    ? await Promise.all([
        prisma.venueFavorite.findMany({
          where: { customerId, venueId: { in: ids } },
          select: { venueId: true },
        }),
        prisma.venueCustomer.findMany({
          where: { customerId, venueId: { in: ids } },
          select: {
            venueId: true,
            bookingCount: true,
            cards: {
              where: { status: { in: ["OPEN", "EARNED"] }, expiresAt: { gt: now } },
              select: { status: true, requiredStamps: true, _count: { select: { stamps: true } } },
              take: 1,
            },
          },
        }),
      ])
    : [[], []];
  const saved = new Set(favorites.map((favorite) => favorite.venueId));
  const played = new Map(customers.map((customer) => [customer.venueId, customer]));
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
      settings: { select: { loyaltyStamps: true } },
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
          justFreed: time.justFreed,
        })),
        justFreed: row.justFreed,
        loyalty: venue.settings?.loyaltyStamps != null,
        you: customerId ? youAt(venue.id, saved, played) : null,
      },
    ];
  });
};

// The signed-in player at a venue, for its card's badge ("Free booking ready", "2 of 4", "Played
// here 3×") and heart.
const youAt = (
  venueId: string,
  saved: Set<string>,
  played: Map<
    string,
    {
      bookingCount: number;
      cards: {
        status: "OPEN" | "EARNED" | "REDEEMED" | "EXPIRED";
        requiredStamps: number;
        _count: { stamps: number };
      }[];
    }
  >,
): NonNullable<VenueCard["you"]> => {
  const customer = played.get(venueId);
  const card = customer?.cards[0];
  return {
    favorite: saved.has(venueId),
    played: customer?.bookingCount ?? 0,
    card:
      card && (card.status === "OPEN" || card.status === "EARNED")
        ? { status: card.status, stamps: card._count.stamps, required: card.requiredStamps }
        : null,
  };
};

// How the venues a search finds spread over price and distance: the Filters sheet's price chart
// and Where's radius bars. Every venue the search would find out to the farthest radius, with its
// cheapest hour (any price) and whether a start fits the price range; the prices then count those
// inside the radius, the distances those in the price range.
export const venueSpread = async (
  query: VenueSpreadQuery,
  clock: Clock = systemClock,
): Promise<VenueSpread> => {
  const { id: marketplaceId, timezone, currency } = await activeMarketplace(query.marketplace);
  const now = clock.now();
  const { startsOf, atStart } = await bookable(query, timezone, now, { priced: false });
  const { point, area, near, name, venue } = filtersFor({
    ...query,
    radius: SEARCH_RADIUS_KM.max,
  });
  const fits = Prisma.sql`(true ${
    query.priceMin !== undefined
      ? Prisma.sql`AND free.price >= ${query.priceMin * query.hours}`
      : Prisma.empty
  } ${query.priceMax !== undefined ? Prisma.sql`AND free.price <= ${query.priceMax * query.hours}` : Prisma.empty})`;
  const rows = await prisma.$queryRaw<
    { distance: number | null; cheapest: number; fits: boolean }[]
  >`
    SELECT ${point ? Prisma.sql`ST_Distance(v.coordinates, ${point})::float8` : Prisma.sql`NULL::float8`} AS distance,
           b.cheapest, b.fits
    FROM "Venue" v
    CROSS JOIN LATERAL (
      SELECT min(free.price)::float8 / ${query.hours} AS cheapest, bool_or(${fits}) AS fits
      FROM ${startsOf(Prisma.sql`v.id`)} ${atStart}
    ) b
    WHERE v.status = 'LIVE' AND v."marketplaceId" = ${marketplaceId}::uuid
      ${area} ${near} ${name} ${venue}
      AND b.cheapest IS NOT NULL`;

  const inRadius = rows.filter(
    (row) => row.distance === null || row.distance <= query.radius * 1000,
  );
  const bands = inRadius.map((row) => Math.floor(row.cheapest / PRICE_STEP));
  const prices =
    bands.length === 0
      ? []
      : Array.from({ length: Math.max(...bands) - Math.min(...bands) + 1 }, (_, i) => {
          const band = Math.min(...bands) + i;
          return { from: band * PRICE_STEP, venues: bands.filter((b) => b === band).length };
        });
  const fitting = rows.filter((row) => row.fits);
  const distances = point
    ? Array.from(
        { length: SEARCH_RADIUS_KM.max },
        (_, i) => fitting.filter((row) => (row.distance ?? 0) <= (i + 1) * 1000).length,
      )
    : null;
  return { currency, prices, distances };
};

// Where there are live venues: governorates (top-level places) and the areas just under them,
// counting each venue toward the area it's in or under.
export const venueCoverage = async (
  query: VenueCoverageQuery,
  language: Language,
): Promise<VenueCoverage> => {
  const { id: marketplaceId } = await activeMarketplace(query.marketplace);
  const rows = await prisma.$queryRaw<
    { governorate: string; area: string | null; venues: number }[]
  >`
    WITH RECURSIVE tree AS (
      SELECT id, id AS governorate, NULL::uuid AS area
      FROM "Location" WHERE "parentId" IS NULL AND "marketplaceId" = ${marketplaceId}::uuid
      UNION ALL
      SELECT l.id, t.governorate, coalesce(t.area, l.id)
      FROM "Location" l JOIN tree t ON l."parentId" = t.id
    )
    SELECT t.governorate, t.area, count(*)::int AS venues
    FROM "Venue" v JOIN tree t ON t.id = v."locationId"
    WHERE v.status = 'LIVE' AND v."marketplaceId" = ${marketplaceId}::uuid
    GROUP BY 1, 2`;
  const ids = [...new Set(rows.flatMap((row) => [row.governorate, row.area ?? row.governorate]))];
  const places = await prisma.location.findMany({
    where: { id: { in: ids } },
    select: { id: true, ...names },
  });
  const nameOf = (id: string) =>
    nameIn(places.find((place) => place.id === id)?.translations ?? [], language);
  const governorates = [...new Set(rows.map((row) => row.governorate))].map((id) => {
    const mine = rows.filter((row) => row.governorate === id);
    const areas = mine
      .filter((row): row is typeof row & { area: string } => row.area !== null)
      .map((row) => ({ id: row.area, name: nameOf(row.area), venues: row.venues }))
      .sort((a, b) => b.venues - a.venues);
    return {
      id,
      name: nameOf(id),
      venues: mine.reduce((sum, row) => sum + row.venues, 0),
      areas,
    };
  });
  return { data: governorates.sort((a, b) => b.venues - a.venues) };
};
