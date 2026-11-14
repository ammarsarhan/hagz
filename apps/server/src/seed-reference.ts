import type { AmenityIcon, Locality } from "@hagz/contracts";
import { prisma } from "@/platform/db/prisma";
import { cache, queueConnection } from "@/platform/redis/connections";
import EGYPT_BOUNDARY from "./reference/egypt-boundary.json";

// Reference data for Egypt, the launch marketplace: the marketplace itself, its 27 governorates, the
// districts and cities of the launch areas (Cairo, Giza, Alexandria), and its amenity options. Admins
// add the rest of the tree on the Platform page.
//
// Safe in every environment and safe to run again: it only adds what's missing, found by code, slug
// or key, and never changes a row an admin may have edited since.
//
//   pnpm --filter @hagz/server seed:reference
//   (deployed: node dist/seed-reference.js)

// Roughly the middle of the area, as [latitude, longitude]: a venue's pin suggests the nearest
// one. Taken from Google's geocoder (2026-11-14) and checked by hand; Miami, Faisal and Haram aren't
// areas to Google, so theirs are estimates. Admins can move any of them on the Platform page.
type Center = [number, number];

interface Place {
  slug: string;
  en: string;
  ar: string;
  locality: Locality;
  center: Center;
  children?: Place[];
}

const district = (slug: string, en: string, ar: string, center: Center): Place => ({
  slug,
  en,
  ar,
  locality: "DISTRICT",
  center,
});
const city = (slug: string, en: string, ar: string, center: Center): Place => ({
  slug,
  en,
  ar,
  locality: "CITY",
  center,
});
const governorate = (
  slug: string,
  en: string,
  ar: string,
  center: Center,
  children: Place[] = [],
): Place => ({
  slug,
  en,
  ar,
  locality: "GOVERNORATE",
  center,
  children,
});

const EGYPT: Place[] = [
  governorate(
    "cairo",
    "Cairo",
    "القاهرة",
    [29.9538, 31.537],
    [
      district("nasr-city", "Nasr City", "مدينة نصر", [30.0511, 31.3656]),
      district("heliopolis", "Heliopolis", "مصر الجديدة", [30.1123, 31.3439]),
      district("maadi", "Maadi", "المعادي", [29.9595, 31.2589]),
      district("zamalek", "Zamalek", "الزمالك", [30.0609, 31.2197]),
      district("downtown", "Downtown", "وسط البلد", [30.0467, 31.2347]),
      district("mokattam", "Mokattam", "المقطم", [30.0217, 31.3033]),
      district("shubra", "Shubra", "شبرا", [30.0725, 31.2498]),
      city("new-cairo", "New Cairo", "القاهرة الجديدة", [30.0363, 31.4758]),
      city("el-shorouk", "El Shorouk", "الشروق", [30.1618, 31.6243]),
    ],
  ),
  governorate(
    "giza",
    "Giza",
    "الجيزة",
    [28.7666, 29.2321],
    [
      district("dokki", "Dokki", "الدقي", [30.0383, 31.2114]),
      district("mohandessin", "Mohandessin", "المهندسين", [30.0553, 31.2032]),
      district("agouza", "Agouza", "العجوزة", [30.0511, 31.2126]),
      district("haram", "Haram", "الهرم", [29.992, 31.158]),
      district("faisal", "Faisal", "فيصل", [30.005, 31.175]),
      city("6th-of-october", "6th of October", "السادس من أكتوبر", [29.9611, 30.9296]),
      city("sheikh-zayed", "Sheikh Zayed", "الشيخ زايد", [30.0382, 30.9794]),
    ],
  ),
  governorate(
    "alexandria",
    "Alexandria",
    "الإسكندرية",
    [30.8761, 29.7426],
    [
      district("smouha", "Smouha", "سموحة", [31.2155, 29.942]),
      district("sidi-gaber", "Sidi Gaber", "سيدي جابر", [31.2213, 29.9379]),
      district("stanley", "Stanley", "ستانلي", [31.2339, 29.9458]),
      district("miami", "Miami", "ميامي", [31.268, 29.996]),
      district("montaza", "Montaza", "المنتزه", [31.3107, 30.0607]),
      district("agami", "Agami", "العجمي", [31.0988, 29.7667]),
    ],
  ),
  governorate("qalyubia", "Qalyubia", "القليوبية", [30.222, 31.3084]),
  governorate("sharqia", "Sharqia", "الشرقية", [30.7327, 31.7195]),
  governorate("dakahlia", "Dakahlia", "الدقهلية", [31.1656, 31.4913]),
  governorate("gharbia", "Gharbia", "الغربية", [30.8754, 31.0335]),
  governorate("monufia", "Monufia", "المنوفية", [30.5972, 30.9876]),
  governorate("beheira", "Beheira", "البحيرة", [30.8481, 30.3436]),
  governorate("kafr-el-sheikh", "Kafr El Sheikh", "كفر الشيخ", [31.1431, 30.8039]),
  governorate("damietta", "Damietta", "دمياط", [31.3626, 31.6739]),
  governorate("port-said", "Port Said", "بورسعيد", [31.1042, 32.3108]),
  governorate("ismailia", "Ismailia", "الإسماعيلية", [30.5831, 32.2654]),
  governorate("suez", "Suez", "السويس", [29.3682, 32.1746]),
  governorate("faiyum", "Faiyum", "الفيوم", [29.3565, 30.62]),
  governorate("beni-suef", "Beni Suef", "بني سويف", [28.8939, 31.4456]),
  governorate("minya", "Minya", "المنيا", [28.2847, 30.5279]),
  governorate("asyut", "Asyut", "أسيوط", [27.2134, 31.4456]),
  governorate("sohag", "Sohag", "سوهاج", [26.6938, 32.1746]),
  governorate("qena", "Qena", "قنا", [26.174, 32.8987]),
  governorate("luxor", "Luxor", "الأقصر", [25.442, 32.8084]),
  governorate("aswan", "Aswan", "أسوان", [23.6966, 32.7181]),
  governorate("red-sea", "Red Sea", "البحر الأحمر", [24.6826, 34.1532]),
  governorate("new-valley", "New Valley", "الوادي الجديد", [24.5456, 27.1735]),
  governorate("matrouh", "Matrouh", "مطروح", [29.5696, 26.4194]),
  governorate("north-sinai", "North Sinai", "شمال سيناء", [30.2824, 33.6176]),
  governorate("south-sinai", "South Sinai", "جنوب سيناء", [28.971, 33.6176]),
];

const AMENITIES: { key: string; icon: AmenityIcon; en: string; ar: string }[] = [
  { key: "floodlights", icon: "floodlights", en: "Floodlights", ar: "كشافات إضاءة" },
  { key: "parking", icon: "parking", en: "Parking", ar: "موقف سيارات" },
  { key: "changing_rooms", icon: "changing_rooms", en: "Changing rooms", ar: "غرف تبديل الملابس" },
  { key: "showers", icon: "showers", en: "Showers", ar: "دشات" },
  { key: "cafe", icon: "cafe", en: "Café", ar: "كافيتريا" },
  { key: "ball_rental", icon: "ball_rental", en: "Ball rental", ar: "تأجير الكرة" },
];

const names = (en: string, ar: string) => [
  { language: "EN" as const, name: en },
  { language: "AR" as const, name: ar },
];

const counts = { marketplace: 0, locations: 0, centers: 0, boundaries: 0, amenities: 0 };

// Egypt's border, which a venue's pin must fall inside (venues' pin-checks.ts). From Natural Earth's
// 1:10m "Admin 0 – Countries" (naturalearthdata.com, public domain; feature ADM0_A3 = EGY, which
// includes the Halaib triangle Egypt administers), widened by 2 km so venues on the coast and in
// border towns aren't cut off by the coarse coastline, then simplified to about 500 m in PostGIS:
//
//   ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(
//     ST_Buffer(ST_GeomFromGeoJSON(<feature geometry>)::geography, 2000)::geometry, 0.005)), 5)
//
// Checked against Alexandria's corniche, Montaza, Taba, Rafah, Siwa and Halaib (inside) and Eilat,
// Aqaba, Gaza City, Benghazi and Khartoum (outside).

const ensureMarketplace = async () => {
  const existing = await prisma.marketplace.findUnique({ where: { code: "EG" } });
  if (existing) return existing;
  counts.marketplace++;
  return prisma.marketplace.create({
    data: {
      code: "EG",
      currency: "EGP",
      dialCode: "+20",
      timezone: "Africa/Cairo",
      taxRate: 1400,
      isActive: true,
      translations: { create: names("Egypt", "مصر") },
    },
  });
};

// Slugs are unique among siblings through partial indexes, which Prisma can't upsert on.
const ensurePlace = async (marketplaceId: string, parentId: string | null, place: Place) => {
  const existing = await prisma.location.findFirst({
    where: { marketplaceId, parentId, slug: place.slug },
    select: { id: true },
  });
  const id =
    existing?.id ??
    (
      await prisma.location.create({
        data: {
          marketplaceId,
          parentId,
          slug: place.slug,
          locality: place.locality,
          translations: { create: names(place.en, place.ar) },
        },
        select: { id: true },
      })
    ).id;
  if (!existing) counts.locations++;
  // Only where there's none yet: an admin may have moved it since.
  const [latitude, longitude] = place.center;
  counts.centers += await prisma.$executeRaw`
    UPDATE "Location"
    SET center = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
    WHERE id = ${id}::uuid AND center IS NULL`;
  for (const child of place.children ?? []) await ensurePlace(marketplaceId, id, child);
};

const ensureAmenity = async (marketplaceId: string, amenity: (typeof AMENITIES)[number]) => {
  const existing = await prisma.amenityOption.findUnique({
    where: { marketplaceId_key: { marketplaceId, key: amenity.key } },
    select: { id: true },
  });
  if (existing) return;
  counts.amenities++;
  await prisma.amenityOption.create({
    data: {
      marketplaceId,
      key: amenity.key,
      icon: amenity.icon,
      translations: { create: names(amenity.en, amenity.ar) },
    },
  });
};

// Only where there's none yet: an admin may have replaced it since.
const ensureBoundary = async (marketplaceId: string, boundary: object) => {
  counts.boundaries += await prisma.$executeRaw`
    UPDATE "Marketplace"
    SET boundary = ST_GeomFromGeoJSON(${JSON.stringify(boundary)})::geography
    WHERE id = ${marketplaceId}::uuid AND boundary IS NULL`;
};

try {
  const egypt = await ensureMarketplace();
  await ensureBoundary(egypt.id, EGYPT_BOUNDARY);
  for (const place of EGYPT) await ensurePlace(egypt.id, null, place);
  for (const amenity of AMENITIES) await ensureAmenity(egypt.id, amenity);
  console.log(
    `Egypt: added ${counts.marketplace} marketplace, ${counts.locations} locations, ` +
      `${counts.centers} area centres, ${counts.boundaries} border, ` +
      `${counts.amenities} amenity options ` +
      `(everything else was already there).`,
  );
} finally {
  await prisma.$disconnect();
  // Importing prisma loads the platform, which opens the queue connection; close both Redis clients.
  queueConnection.disconnect();
  cache.disconnect();
}
