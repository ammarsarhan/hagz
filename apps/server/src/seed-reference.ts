import type { AmenityIcon, Locality } from "@hagz/contracts";
import { prisma } from "@/platform/db/prisma";
import { cache, queueConnection } from "@/platform/redis/connections";

// Reference data for Egypt, the launch marketplace: the marketplace itself, its 27 governorates, the
// districts and cities of the launch areas (Cairo, Giza, Alexandria), and its amenity options. Admins
// add the rest of the tree on the Platform page.
//
// Safe in every environment and safe to run again: it only adds what's missing, found by code, slug
// or key, and never changes a row an admin may have edited since.
//
//   pnpm --filter @hagz/server seed:reference
//   (deployed: node dist/seed-reference.js)

interface Place {
  slug: string;
  en: string;
  ar: string;
  locality: Locality;
  children?: Place[];
}

const district = (slug: string, en: string, ar: string): Place => ({
  slug,
  en,
  ar,
  locality: "DISTRICT",
});
const city = (slug: string, en: string, ar: string): Place => ({ slug, en, ar, locality: "CITY" });
const governorate = (slug: string, en: string, ar: string, children: Place[] = []): Place => ({
  slug,
  en,
  ar,
  locality: "GOVERNORATE",
  children,
});

const EGYPT: Place[] = [
  governorate("cairo", "Cairo", "القاهرة", [
    district("nasr-city", "Nasr City", "مدينة نصر"),
    district("heliopolis", "Heliopolis", "مصر الجديدة"),
    district("maadi", "Maadi", "المعادي"),
    district("zamalek", "Zamalek", "الزمالك"),
    district("downtown", "Downtown", "وسط البلد"),
    district("mokattam", "Mokattam", "المقطم"),
    district("shubra", "Shubra", "شبرا"),
    city("new-cairo", "New Cairo", "القاهرة الجديدة"),
    city("el-shorouk", "El Shorouk", "الشروق"),
  ]),
  governorate("giza", "Giza", "الجيزة", [
    district("dokki", "Dokki", "الدقي"),
    district("mohandessin", "Mohandessin", "المهندسين"),
    district("agouza", "Agouza", "العجوزة"),
    district("haram", "Haram", "الهرم"),
    district("faisal", "Faisal", "فيصل"),
    city("6th-of-october", "6th of October", "السادس من أكتوبر"),
    city("sheikh-zayed", "Sheikh Zayed", "الشيخ زايد"),
  ]),
  governorate("alexandria", "Alexandria", "الإسكندرية", [
    district("smouha", "Smouha", "سموحة"),
    district("sidi-gaber", "Sidi Gaber", "سيدي جابر"),
    district("stanley", "Stanley", "ستانلي"),
    district("miami", "Miami", "ميامي"),
    district("montaza", "Montaza", "المنتزه"),
    district("agami", "Agami", "العجمي"),
  ]),
  governorate("qalyubia", "Qalyubia", "القليوبية"),
  governorate("sharqia", "Sharqia", "الشرقية"),
  governorate("dakahlia", "Dakahlia", "الدقهلية"),
  governorate("gharbia", "Gharbia", "الغربية"),
  governorate("monufia", "Monufia", "المنوفية"),
  governorate("beheira", "Beheira", "البحيرة"),
  governorate("kafr-el-sheikh", "Kafr El Sheikh", "كفر الشيخ"),
  governorate("damietta", "Damietta", "دمياط"),
  governorate("port-said", "Port Said", "بورسعيد"),
  governorate("ismailia", "Ismailia", "الإسماعيلية"),
  governorate("suez", "Suez", "السويس"),
  governorate("faiyum", "Faiyum", "الفيوم"),
  governorate("beni-suef", "Beni Suef", "بني سويف"),
  governorate("minya", "Minya", "المنيا"),
  governorate("asyut", "Asyut", "أسيوط"),
  governorate("sohag", "Sohag", "سوهاج"),
  governorate("qena", "Qena", "قنا"),
  governorate("luxor", "Luxor", "الأقصر"),
  governorate("aswan", "Aswan", "أسوان"),
  governorate("red-sea", "Red Sea", "البحر الأحمر"),
  governorate("new-valley", "New Valley", "الوادي الجديد"),
  governorate("matrouh", "Matrouh", "مطروح"),
  governorate("north-sinai", "North Sinai", "شمال سيناء"),
  governorate("south-sinai", "South Sinai", "جنوب سيناء"),
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

const counts = { marketplace: 0, locations: 0, amenities: 0 };

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

try {
  const egypt = await ensureMarketplace();
  for (const place of EGYPT) await ensurePlace(egypt.id, null, place);
  for (const amenity of AMENITIES) await ensureAmenity(egypt.id, amenity);
  console.log(
    `Egypt: added ${counts.marketplace} marketplace, ${counts.locations} locations, ` +
      `${counts.amenities} amenity options (everything else was already there).`,
  );
} finally {
  await prisma.$disconnect();
  // Importing prisma loads the platform, which opens the queue connection; close both Redis clients.
  queueConnection.disconnect();
  cache.disconnect();
}
