import { execFileSync } from "node:child_process";
import "dotenv/config";
import pg from "pg";
import { StaffPermissions, SURFACES_BY_SPORT } from "@hagz/contracts";

// Development only: a database at launch scale, for checking search query plans (PR 3.1, plan.md):
// about 1,000 LIVE venues with 4 grounds each on average, and 90 days of hourly slots (about 5.8M
// rows), spread over the seeded areas of Cairo, Giza and Alexandria. It builds its own database,
// hagz_scale, on the local server from .env's DATABASE_URL (which it never touches): drops and
// recreates it, runs the real migrations and seed:reference, then adds the data. Refuses any server
// that isn't local. The same --seed always gives the same venues, so plans compare between runs.
//
//   pnpm --filter @hagz/server seed:scale
//   pnpm --filter @hagz/server seed:scale --venues 200
//
// Taken slots are BLOCKED, not BOOKED: a booked slot needs a real booking, and search only asks
// whether a slot is AVAILABLE, so the plans are the same without millions of bookings.

const args = new Map(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map((pair) => pair.trim().split(/\s+/) as [string, string]),
);
const VENUES = Number(args.get("venues") ?? 1000);
const SEED = Number(args.get("seed") ?? 2026);
const DATABASE = "hagz_scale";
const BATCH = 50; // Venues per slot insert, so progress shows.
// Seeded venues have no staff, so their invitation defaults are never used: view everywhere.
const PERMISSIONS = Object.fromEntries(
  Object.keys(StaffPermissions.shape).map((area) => [area, "view"]),
);

const base = process.env.DATABASE_URL;
if (!base) throw new Error("DATABASE_URL isn't set (.env).");
const local = new URL(base);
if (!["localhost", "127.0.0.1", "[::1]"].includes(local.hostname)) {
  throw new Error(`Refusing to build ${DATABASE} on ${local.hostname}: local servers only.`);
}
const at = (database: string) => Object.assign(new URL(base), { pathname: `/${database}` }).href;
const scaleUrl = at(DATABASE);

// A small seeded generator (mulberry32), so a run is repeatable.
let state = SEED >>> 0;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const chance = (p: number) => random() < p;
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
const weighted = <T>(entries: readonly (readonly [T, number])[]): T => {
  let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  const last = entries.at(-1);
  if (!last) throw new Error("weighted() needs entries.");
  return last[0];
};

// Venue names: a brand, then the area ("Golden Goal Smouha", "الهدف الذهبي سموحة").
const BRANDS: readonly (readonly [string, string])[] = [
  ["Golden Goal", "الهدف الذهبي"],
  ["Kickoff", "كيك أوف"],
  ["The Pitch", "ذا بيتش"],
  ["Champions", "الأبطال"],
  ["Victory", "النصر"],
  ["Elite Sports", "إيليت سبورتس"],
  ["Stars Arena", "ساحة النجوم"],
  ["Green Field", "الملعب الأخضر"],
  ["Al Nour Club", "نادي النور"],
  ["Smash", "سماش"],
  ["Matchpoint", "ماتش بوينت"],
  ["Padel Point", "بادل بوينت"],
  ["Zone", "زون"],
  ["Al Salam", "السلام"],
  ["Youth Centre", "مركز الشباب"],
  ["Royal", "رويال"],
  ["Hattrick", "هاتريك"],
  ["Corner", "كورنر"],
  ["Prime Courts", "برايم كورتس"],
  ["Fair Play", "فير بلاي"],
];

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type Sport = keyof typeof SURFACES_BY_SPORT;

// EGP per hour, in piastres: [lowest, highest] base price.
const PRICES = {
  FIVE_A_SIDE: [400, 800],
  SEVEN_A_SIDE: [700, 1200],
  ELEVEN_A_SIDE: [1500, 3000],
  PADEL: [300, 600],
  TENNIS: [200, 400],
  BASKETBALL: [300, 600],
  VOLLEYBALL: [200, 400],
} as const satisfies Record<string, readonly [number, number]>;

const footballSize = () =>
  weighted([
    ["FIVE_A_SIDE", 65],
    ["SEVEN_A_SIDE", 25],
    ["ELEVEN_A_SIDE", 10],
  ] as const);

const ground = (venueId: string, sport: Sport, position: number) => {
  const size = sport === "FOOTBALL" ? footballSize() : "STANDARD";
  const [low, high] =
    size !== "STANDARD" ? PRICES[size] : sport === "FOOTBALL" ? PRICES.FIVE_A_SIDE : PRICES[sport];
  const surfaces = SURFACES_BY_SPORT[sport];
  const surface = chance(0.8) ? surfaces[0] : pick(surfaces);
  const environment = weighted(
    sport === "FOOTBALL"
      ? ([
          ["OUTDOOR", 80],
          ["COVERED", 15],
          ["INDOOR", 5],
        ] as const)
      : ([
          ["OUTDOOR", 30],
          ["COVERED", 40],
          ["INDOOR", 30],
        ] as const),
  );
  const basePrice = Math.round(between(low, high) / 10) * 10 * 100;
  return {
    id: crypto.randomUUID(),
    venueId,
    sport,
    size,
    surface,
    environment,
    position,
    basePrice,
    peakPrice: chance(0.7) ? Math.round((basePrice * 1.25) / 1000) * 1000 : null,
    discountPrice: chance(0.4) ? Math.round((basePrice * 0.8) / 1000) * 1000 : null,
  };
};

const sportsFor = (count: number): Sport[] => {
  const kind = weighted([
    ["football", 65],
    ["padel", 20],
    ["mixed", 15],
  ] as const);
  if (kind === "football") return Array.from({ length: count }, () => "FOOTBALL" as const);
  if (kind === "padel") return Array.from({ length: count }, () => "PADEL" as const);
  return Array.from({ length: count }, (_, index) =>
    index === 0
      ? "FOOTBALL"
      : pick(["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"] as const),
  );
};

const run = (command: string, commandArgs: string[]) => {
  execFileSync(command, commandArgs, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: scaleUrl, DIRECT_DATABASE_URL: scaleUrl },
  });
};

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;

// 1. A fresh database with the real migrations and reference data.
const admin = new pg.Client({ connectionString: at("postgres") });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${DATABASE}`);
await admin.end();
run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
run("pnpm", ["exec", "tsx", "src/seed-reference.ts"]);
console.log(`${DATABASE}: migrated and seeded reference data (${elapsed()}).`);

const db = new pg.Client({ connectionString: scaleUrl });
await db.connect();
// The migration's 5 s statement timeout is for requests; the slot inserts take longer.
await db.query("SET statement_timeout = 0");
await db.query("SET TIME ZONE 'Africa/Cairo'");
await db.query("SELECT setseed($1)", [(SEED % 1000) / 1000]);

try {
  const { rows: areas } = await db.query<{
    id: string;
    marketplaceId: string;
    slug: string;
    en: string;
    ar: string;
    latitude: number;
    longitude: number;
  }>(`
    SELECT l.id, l."marketplaceId", l.slug, en.name AS en, ar.name AS ar,
           ST_Y(l.center::geometry) AS latitude, ST_X(l.center::geometry) AS longitude
    FROM "Location" l
    JOIN "LocationTranslation" en ON en."locationId" = l.id AND en.language = 'EN'
    JOIN "LocationTranslation" ar ON ar."locationId" = l.id AND ar.language = 'AR'
    WHERE l.center IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Location" c WHERE c."parentId" = l.id)
    ORDER BY l.slug`);
  if (areas.length === 0) throw new Error("No areas with a centre: did seed:reference run?");
  const { rows: amenities } = await db.query<{ id: string }>(
    `SELECT id FROM "AmenityOption" ORDER BY key`,
  );

  // 2. Venues, their settings, amenities and grounds.
  const venues = [];
  const translations = [];
  const settings = [];
  const venueAmenities = [];
  const hours = [];
  const grounds: ReturnType<typeof ground>[] = [];
  for (let index = 0; index < VENUES; index++) {
    const area = areas[index % areas.length];
    if (!area) throw new Error("No area for this venue.");
    const [brandEn, brandAr] = pick(BRANDS);
    const id = crypto.randomUUID();
    // Up to about 2.5 km from the area's centre.
    const distance = Math.sqrt(random()) * 2500;
    const bearing = random() * 2 * Math.PI;
    const rated = chance(0.7);
    venues.push({
      id,
      marketplaceId: area.marketplaceId,
      locationId: area.id,
      slug: `${slug(brandEn)}-${area.slug}-${index + 1}`,
      latitude: area.latitude + (distance * Math.cos(bearing)) / 111_320,
      longitude:
        area.longitude +
        (distance * Math.sin(bearing)) / (111_320 * Math.cos((area.latitude * Math.PI) / 180)),
      averageRating: rated ? (3.2 + random() * 1.8).toFixed(2) : null,
      reviewCount: rated ? Math.floor(1 + random() ** 2 * 400) : 0,
    });
    translations.push({ venueId: id, language: "EN", name: `${brandEn} ${area.en}` });
    translations.push({ venueId: id, language: "AR", name: `${brandAr} ${area.ar}` });
    const paymentMode = weighted([
      ["MANUAL", 50],
      ["DEPOSIT", 30],
      ["PLATFORM", 20],
    ] as const);
    const loyalty = chance(0.35);
    settings.push({
      venueId: id,
      autoConfirm: chance(0.75),
      paymentMode,
      depositPercent: paymentMode === "DEPOSIT" ? pick([20, 25, 30, 50]) : null,
      cancellationPolicy: pick(["FLEXIBLE", "MODERATE", "STRICT"] as const),
      loyaltyStamps: loyalty ? between(4, 6) : null,
      loyaltyWindow: loyalty ? pick([30, 45, 60]) : null,
    });
    for (const amenity of amenities) {
      if (chance(0.5))
        venueAmenities.push({
          venueId: id,
          optionId: amenity.id,
          marketplaceId: area.marketplaceId,
        });
    }
    // Opening between 08:00 and 10:00, closing between midnight and 02:00: about 16 hours a day.
    hours.push({ venueId: id, opens: between(8, 10), closes: between(24, 26) });
    const count = weighted([
      [1, 10],
      [2, 15],
      [3, 20],
      [4, 20],
      [5, 15],
      [6, 10],
      [8, 10],
    ] as const);
    sportsFor(count).forEach((sport, position) => grounds.push(ground(id, sport, position)));
  }

  const insert = (sql: string, rows: object[]) => db.query(sql, [JSON.stringify(rows)]);
  await db.query("BEGIN");
  await insert(
    `INSERT INTO "Venue" (id, "marketplaceId", "locationId", slug, status, coordinates, "averageRating", "reviewCount", "updatedAt")
     SELECT id, "marketplaceId", "locationId", slug, 'LIVE',
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography, "averageRating", "reviewCount", now()
     FROM json_to_recordset($1) AS v(id uuid, "marketplaceId" uuid, "locationId" uuid, slug text,
       latitude float8, longitude float8, "averageRating" numeric, "reviewCount" int)`,
    venues,
  );
  await insert(
    `INSERT INTO "VenueTranslation" ("venueId", language, name)
     SELECT "venueId", language::"Language", name FROM json_to_recordset($1) AS t("venueId" uuid, language text, name text)`,
    translations,
  );
  await db.query(
    `INSERT INTO "VenueSettings" ("venueId", "defaultPermissions", "autoConfirm", "paymentMode", "depositPercent",
       "cancellationPolicy", "loyaltyStamps", "loyaltyWindow", "updatedAt")
     SELECT "venueId", $2::jsonb, "autoConfirm", "paymentMode"::"PaymentMode", "depositPercent",
            "cancellationPolicy"::"CancellationPolicy", "loyaltyStamps", "loyaltyWindow", now()
     FROM json_to_recordset($1) AS s("venueId" uuid, "autoConfirm" boolean, "paymentMode" text, "depositPercent" int,
       "cancellationPolicy" text, "loyaltyStamps" int, "loyaltyWindow" int)`,
    [JSON.stringify(settings), JSON.stringify(PERMISSIONS)],
  );
  await insert(
    `INSERT INTO "VenueAmenity" ("venueId", "optionId", "marketplaceId")
     SELECT * FROM json_to_recordset($1) AS a("venueId" uuid, "optionId" uuid, "marketplaceId" uuid)`,
    venueAmenities,
  );
  await insert(
    `INSERT INTO "Ground" (id, "venueId", sport, size, surface, environment, position, "basePrice", "peakPrice", "discountPrice", "updatedAt")
     SELECT id, "venueId", sport::"GroundSport", size::"GroundSize", surface::"GroundSurface",
            environment::"GroundEnvironment", position, "basePrice", "peakPrice", "discountPrice", now()
     FROM json_to_recordset($1) AS g(id uuid, "venueId" uuid, sport text, size text, surface text, environment text,
       position int, "basePrice" int, "peakPrice" int, "discountPrice" int)`,
    grounds,
  );
  await db.query(
    `INSERT INTO "GroundSettings" ("groundId", "generatedUntil", "generatedAt", "scheduleVersion", "updatedAt")
     SELECT id, now() + interval '90 days', now(), 1, now() FROM "Ground"`,
  );
  await db.query("COMMIT");
  console.log(
    `Venues: ${venues.length}, grounds: ${grounds.length}, amenities: ${venueAmenities.length} (${elapsed()}).`,
  );

  // 3. Slots: every opening hour for 90 days. Peak hours and the coming days are more often taken.
  await db.query(
    `CREATE TEMP TABLE scale_hours AS
     SELECT * FROM json_to_recordset($1) AS h("venueId" uuid, opens int, closes int)`,
    [JSON.stringify(hours)],
  );
  let slots = 0;
  for (let from = 0; from < venues.length; from += BATCH) {
    const ids = venues.slice(from, from + BATCH).map((venue) => venue.id);
    const result = await db.query(
      `INSERT INTO "GroundSlot" (id, "groundId", "venueId", "startsAt", "endsAt", tier, price, status, "scheduleVersion", "updatedAt")
       SELECT uuidv7(), g.id, g."venueId", t.starts, t.starts + interval '1 hour', t.tier,
              CASE t.tier WHEN 'PEAK' THEN g."peakPrice" WHEN 'DISCOUNT' THEN g."discountPrice" ELSE g."basePrice" END,
              CASE WHEN random() < (CASE WHEN t.tier = 'PEAK' THEN 0.55 ELSE 0.2 END) * (1 - d.day / 120.0)
                   THEN 'BLOCKED' ELSE 'AVAILABLE' END::"SlotStatus",
              1, now()
       FROM "Ground" g
       JOIN scale_hours o ON o."venueId" = g."venueId"
       CROSS JOIN generate_series(0, 90) AS d(day)
       CROSS JOIN LATERAL generate_series(o.opens, o.closes - 1) AS h(hour)
       CROSS JOIN LATERAL (
         SELECT ((current_date + d.day)::timestamp + make_interval(hours => h.hour)) AT TIME ZONE 'Africa/Cairo' AS starts,
                (CASE WHEN h.hour % 24 BETWEEN 18 AND 23 AND g."peakPrice" IS NOT NULL THEN 'PEAK'
                      WHEN h.hour BETWEEN 8 AND 11 AND g."discountPrice" IS NOT NULL THEN 'DISCOUNT'
                      ELSE 'BASE' END)::"PriceTier" AS tier
       ) t
       WHERE g."venueId" = ANY($1::uuid[])
         AND t.starts > now() AND t.starts <= now() + interval '90 days'`,
      [ids],
    );
    slots += result.rowCount ?? 0;
    console.log(
      `Slots: ${slots.toLocaleString("en")} (${Math.min(from + BATCH, venues.length)}/${venues.length} venues, ${elapsed()}).`,
    );
  }

  await db.query("ANALYZE");
  const { rows: sizes } = await db.query<{ table: string; rows: string; size: string }>(`
    SELECT relname AS table, n_live_tup::text AS rows, pg_size_pretty(pg_total_relation_size(relid)) AS size
    FROM pg_stat_user_tables WHERE relname IN ('Venue', 'Ground', 'GroundSlot') ORDER BY relname`);
  console.table(sizes);
  console.log(
    `Done in ${elapsed()}. Connect with DATABASE_URL=${scaleUrl.replace(/\/\/[^@]*@/, "//…@")}`,
  );
} finally {
  await db.end();
}
