import { parseArgs } from "node:util";
import { ALL_PERMISSIONS, reconcileGround } from "@/modules/venues";
import { env } from "@/platform/config/env";
import { hashPassword } from "@/platform/crypto/passwords";
import { prisma } from "@/platform/db/prisma";
import { cache, queueConnection } from "@/platform/redis/connections";

// Development only: live venues around a point, so Search has something near you to find. Each is
// filed under the nearest area with a centre, gets one to three grounds open late with peak
// evening prices, a few amenities, a policy and a payment mode, and its slots generated through the
// real generation path. Ratings are set straight on the venue (there are no bookings to review).
// Safe to run again: venues already made (by slug) are left alone.
//
//   pnpm --filter @hagz/server seed:nearby                        (central Alexandria)
//   pnpm --filter @hagz/server seed:nearby --lat 30.04 --lng 31.24 --count 10 --radius 4

const { values } = parseArgs({
  options: {
    lat: { type: "string", default: "31.2155" },
    lng: { type: "string", default: "29.942" },
    count: { type: "string", default: "10" },
    radius: { type: "string", default: "4" },
  },
});
const centre = { latitude: Number(values.lat), longitude: Number(values.lng) };
const count = Number(values.count);
const radiusKm = Number(values.radius);
if (
  !Number.isFinite(centre.latitude) ||
  !Number.isFinite(centre.longitude) ||
  !Number.isInteger(count) ||
  count < 1 ||
  count > 20 ||
  !(radiusKm > 0 && radiusKm <= 30)
) {
  console.error("Usage: seed-nearby [--lat] [--lng] [--count 1-20] [--radius km]");
  process.exit(1);
}
if (env.APP_ENV !== "development") {
  console.error(`Refusing to seed in ${env.APP_ENV}: this script is for local development only.`);
  process.exit(1);
}

// The same seed owner as seed:invitations. +20 100 000 0000 is not a number anyone owns.
const OWNER = { phone: "+201000000000", name: "Seed Owner", password: "seed-owner-password" };

const NAMES = [
  { en: "Smouha Sporting Pitches", ar: "ملاعب سموحة الرياضية" },
  { en: "Gleem Bay Five", ar: "خماسي خليج جليم" },
  { en: "Sidi Gaber Arena", ar: "ملعب سيدي جابر" },
  { en: "Laurent Padel Club", ar: "نادي لوران للبادل" },
  { en: "Stanley Kickoff", ar: "ستانلي كيك أوف" },
  { en: "Kafr Abdo Courts", ar: "ملاعب كفر عبده" },
  { en: "Roushdy Turf", ar: "نجيل رشدي" },
  { en: "Cleopatra Five-a-Side", ar: "كليوباترا خماسي" },
  { en: "Mostafa Kamel Grounds", ar: "ملاعب مصطفى كامل" },
  { en: "Sporting Night League", ar: "دوري سبورتنج الليلي" },
  { en: "Camp Shezar Pitches", ar: "ملاعب كامب شيزار" },
  { en: "Ibrahimia Padel", ar: "إبراهيمية بادل" },
  { en: "Bolkly Arena", ar: "ملعب بولكلي" },
  { en: "Saba Pasha Courts", ar: "ملاعب سابا باشا" },
  { en: "Zizinia Sports Hub", ar: "مركز زيزينيا الرياضي" },
  { en: "Fleming Five", ar: "فليمنج خماسي" },
  { en: "San Stefano Grounds", ar: "ملاعب سان ستيفانو" },
  { en: "Victoria Pitch", ar: "ملعب فيكتوريا" },
  { en: "Schutz Padel", ar: "شوتس بادل" },
  { en: "Louran Turf", ar: "نجيل لوران" },
];

type Sport = "FOOTBALL" | "PADEL" | "TENNIS";
type Size = "FIVE_A_SIDE" | "SEVEN_A_SIDE" | "STANDARD";
interface GroundPlan {
  sport: Sport;
  size: Size;
  surface: "ARTIFICIAL_TURF" | "HARD_COURT";
  environment: "OUTDOOR" | "COVERED";
  base: number; // EGP per hour
}

// What each venue has, varied by its index so the results differ.
const groundsFor = (i: number): GroundPlan[] => {
  const five: GroundPlan = {
    sport: "FOOTBALL",
    size: "FIVE_A_SIDE",
    surface: "ARTIFICIAL_TURF",
    environment: "OUTDOOR",
    base: 300 + (i % 4) * 50,
  };
  const seven: GroundPlan = { ...five, size: "SEVEN_A_SIDE", base: 450 + (i % 3) * 50 };
  const padel: GroundPlan = {
    sport: "PADEL",
    size: "STANDARD",
    surface: "HARD_COURT",
    environment: "COVERED",
    base: 250 + (i % 3) * 50,
  };
  switch (i % 5) {
    case 0:
      return [five, five, seven];
    case 1:
      return [five, five];
    case 2:
      return [padel, padel];
    case 3:
      return [five, padel];
    default:
      return [seven];
  }
};

// Open 4 pm to 2 am (8 am on every third venue), peak from 7 to 11 pm; past midnight goes in the
// next day's row.
const weekFor = (i: number) => {
  const opens = i % 3 === 0 ? 8 : 16;
  const hours: Record<string, "BASE" | "PEAK"> = { "0": "BASE", "1": "BASE" };
  for (let hour = opens; hour < 24; hour++) {
    hours[String(hour)] = hour >= 19 && hour < 23 ? "PEAK" : "BASE";
  }
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, hours }));
};

// A point spread around the centre: a spiral, so venues don't stack and reruns land the same.
const pointFor = (i: number) => {
  const angle = i * 2.399963; // the golden angle
  const distanceKm = radiusKm * Math.sqrt((i + 0.5) / count);
  const dLat = (distanceKm / 111.32) * Math.cos(angle);
  const dLng =
    (distanceKm / (111.32 * Math.cos((centre.latitude * Math.PI) / 180))) * Math.sin(angle);
  return { latitude: centre.latitude + dLat, longitude: centre.longitude + dLng };
};

const ensureOwner = async () =>
  (await prisma.staff.findUnique({ where: { phone: OWNER.phone } })) ??
  prisma.staff.create({
    data: {
      name: OWNER.name,
      phone: OWNER.phone,
      passwordHash: await hashPassword(OWNER.password),
      phoneVerifiedAt: new Date(),
    },
  });

try {
  const marketplace = await prisma.marketplace.findUnique({ where: { code: "EG" } });
  if (!marketplace) throw new Error("No EG marketplace: run seed:reference first.");
  const owner = await ensureOwner();
  const amenities = await prisma.amenityOption.findMany({
    where: { marketplaceId: marketplace.id, isActive: true },
    select: { id: true, key: true },
  });

  for (let i = 0; i < count; i++) {
    const slug = `seed-nearby-${i + 1}`;
    if (await prisma.venue.findUnique({ where: { slug } })) {
      console.log(`  ${slug} already there`);
      continue;
    }
    const at = pointFor(i);
    const names = NAMES[i % NAMES.length] ?? { en: `Seed Venue ${i + 1}`, ar: "ملعب تجريبي" };
    // The nearest area with a centre, as the venue creation flow suggests.
    const [area] = await prisma.$queryRaw<{ id: string; name: string | null }[]>`
      SELECT l.id, t.name
      FROM "Location" l
      LEFT JOIN "LocationTranslation" t ON t."locationId" = l.id AND t.language = 'EN'
      WHERE l."marketplaceId" = ${marketplace.id}::uuid AND l.center IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Location" c WHERE c."parentId" = l.id)
      ORDER BY l.center <-> ST_SetSRID(ST_MakePoint(${at.longitude}, ${at.latitude}), 4326)::geography
      LIMIT 1`;
    if (!area) throw new Error("No areas with centres: run seed:reference first.");

    const venue = await prisma.venue.create({
      data: {
        marketplaceId: marketplace.id,
        locationId: area.id,
        slug,
        status: "LIVE",
        averageRating: (4 + ((i * 37) % 10) / 10).toFixed(2),
        reviewCount: 5 + ((i * 53) % 80),
        translations: {
          create: [
            {
              language: "EN",
              name: names.en,
              description: "Floodlit pitches, open late. Seeded for development.",
              address: `${area.name ?? "Alexandria"}, Alexandria`,
            },
            {
              language: "AR",
              name: names.ar,
              description: "ملاعب بإضاءة، مفتوحة حتى وقت متأخر. بيانات تجريبية.",
              address: "الإسكندرية",
            },
          ],
        },
        settings: {
          create: {
            defaultPermissions: { ...ALL_PERMISSIONS, finance: "none", venue: "view" },
            minimumNotice: 60,
            autoConfirm: i % 4 !== 3,
            paymentMode: i % 3 === 0 ? "MANUAL" : "DEPOSIT",
            depositPercent: i % 3 === 0 ? null : 50,
            cancellationPolicy: (["FLEXIBLE", "MODERATE", "STRICT"] as const)[i % 3],
            ...(i % 2 === 0 ? { loyaltyStamps: 5, loyaltyWindow: 90 } : {}),
          },
        },
        memberships: { create: { staffId: owner.id, role: "OWNER", permissions: ALL_PERMISSIONS } },
      },
    });
    // Amenities share the venue's marketplace column, so they go in after it.
    await prisma.venueAmenity.createMany({
      data: amenities
        .filter((_, k) => (k + i) % 2 === 0 || k === 0)
        .map((option) => ({
          venueId: venue.id,
          optionId: option.id,
          marketplaceId: marketplace.id,
        })),
    });
    await prisma.$executeRaw`
      UPDATE "Venue"
      SET coordinates = ST_SetSRID(ST_MakePoint(${at.longitude}, ${at.latitude}), 4326)::geography
      WHERE id = ${venue.id}::uuid`;

    const plans = groundsFor(i);
    const week = weekFor(i);
    for (const [position, plan] of plans.entries()) {
      const ground = await prisma.ground.create({
        data: {
          venueId: venue.id,
          sport: plan.sport,
          size: plan.size,
          surface: plan.surface,
          environment: plan.environment,
          position,
          basePrice: plan.base * 100,
          peakPrice: (plan.base + 100) * 100,
          translations: {
            create: [
              {
                language: "EN",
                name: plan.sport === "PADEL" ? `Court ${position + 1}` : `Pitch ${position + 1}`,
              },
              {
                language: "AR",
                name: plan.sport === "PADEL" ? `ملعب ${position + 1}` : `ملعب ${position + 1}`,
              },
            ],
          },
          settings: { create: { scheduleVersion: 1, minimumSlots: 1, maximumSlots: 3 } },
          schedules: { create: week },
        },
      });
      await reconcileGround(ground.id);
    }
    console.log(`  ${slug.padEnd(16)} ${names.en} · ${area.name ?? "?"} · ${plans.length} grounds`);
  }
} finally {
  await prisma.$disconnect();
  cache.disconnect();
  queueConnection.disconnect();
}
