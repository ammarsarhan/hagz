import { parseArgs } from "node:util";
import { ALL_PERMISSIONS, createInvitation } from "@/modules/venues";
import { systemClock } from "@/platform/clock/clock";
import { env } from "@/platform/config/env";
import { hashPassword } from "@/platform/crypto/passwords";
import { prisma } from "@/platform/db/prisma";
import { webLinks } from "@/platform/http/links";
import { requireMobileNumber } from "@/platform/phone/phone";
import { cache, queueConnection } from "@/platform/redis/connections";

// Development only: gives a phone number open staff invitations to try the join flow with. Creates
// what the invitations need if it's missing (the Egypt marketplace, Cairo → Nasr City, a seed owner
// and their venues), then invites the phone to each venue through the real invitation code path, so
// an older open invitation is replaced and an existing account gets the in-app notification. Nothing
// is sent over WhatsApp: the codes and links are printed. Safe to run again; each run issues new codes.
//
//   pnpm --filter @hagz/server seed:invitations --phone +201061513190
//   pnpm --filter @hagz/server seed:invitations --phone +201061513190 --count 5

const { values } = parseArgs({
  options: {
    phone: { type: "string" },
    count: { type: "string", default: "3" },
  },
});
const count = Number(values.count);
if (!values.phone || !Number.isInteger(count) || count < 1 || count > 20) {
  console.error("Usage: seed-invitations --phone <E.164> [--count 1-20]");
  process.exit(1);
}
if (env.APP_ENV !== "development") {
  console.error(`Refusing to seed in ${env.APP_ENV}: this script is for local development only.`);
  process.exit(1);
}

const phone = requireMobileNumber(values.phone).e164;

// Fixed so reruns find the same rows. +20 100 000 0000 is not a number anyone owns.
const OWNER = { phone: "+201000000000", name: "Seed Owner", password: "seed-owner-password" };
const VENUES = [
  { en: "Nasr City Arena", ar: "ملعب مدينة نصر" },
  { en: "Abbas El Akkad Club", ar: "نادي عباس العقاد" },
  { en: "Makram Ebeid Pitches", ar: "ملاعب مكرم عبيد" },
  { en: "Zahraa Five-a-Side", ar: "الزهراء خماسي" },
  { en: "Tayaran Sports Hub", ar: "مركز الطيران الرياضي" },
];

const ensureMarketplace = () =>
  prisma.marketplace.upsert({
    where: { code: "EG" },
    update: {},
    create: {
      code: "EG",
      currency: "EGP",
      dialCode: "+20",
      timezone: "Africa/Cairo",
      taxRate: 1400,
      isActive: true,
      translations: {
        create: [
          { language: "EN", name: "Egypt" },
          { language: "AR", name: "مصر" },
        ],
      },
    },
  });

// Slugs are unique among siblings through partial indexes, which Prisma can't upsert on.
const ensureLocation = async (
  marketplaceId: string,
  parentId: string | null,
  {
    slug,
    locality,
    en,
    ar,
  }: { slug: string; locality: "GOVERNORATE" | "DISTRICT"; en: string; ar: string },
) =>
  (await prisma.location.findFirst({ where: { marketplaceId, parentId, slug } })) ??
  prisma.location.create({
    data: {
      marketplaceId,
      parentId,
      slug,
      locality,
      translations: {
        create: [
          { language: "EN", name: en },
          { language: "AR", name: ar },
        ],
      },
    },
  });

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

const ensureVenue = async (
  marketplaceId: string,
  locationId: string,
  ownerId: string,
  index: number,
) => {
  const slug = `seed-venue-${index + 1}`;
  const names = VENUES[index % VENUES.length] ?? { en: "Seed Venue", ar: "ملعب تجريبي" };
  const suffix = index >= VENUES.length ? ` ${index + 1}` : "";
  return (
    (await prisma.venue.findUnique({ where: { slug } })) ??
    prisma.venue.create({
      data: {
        marketplaceId,
        locationId,
        slug,
        status: "LIVE",
        translations: {
          create: [
            {
              language: "EN",
              name: names.en + suffix,
              description: "Seeded for development.",
              address: "Nasr City, Cairo",
            },
            {
              language: "AR",
              name: names.ar + suffix,
              description: "بيانات تجريبية.",
              address: "مدينة نصر، القاهرة",
            },
          ],
        },
        settings: {
          create: {
            defaultPermissions: {
              ...ALL_PERMISSIONS,
              finance: "none",
              venue: "view",
            },
          },
        },
        memberships: { create: { staffId: ownerId, role: "OWNER", permissions: ALL_PERMISSIONS } },
      },
    })
  );
};

try {
  const marketplace = await ensureMarketplace();
  const cairo = await ensureLocation(marketplace.id, null, {
    slug: "cairo",
    locality: "GOVERNORATE",
    en: "Cairo",
    ar: "القاهرة",
  });
  const nasrCity = await ensureLocation(marketplace.id, cairo.id, {
    slug: "nasr-city",
    locality: "DISTRICT",
    en: "Nasr City",
    ar: "مدينة نصر",
  });
  const owner = await ensureOwner();

  console.log(`Inviting ${phone} to ${count} venue(s), as ${owner.name} (${OWNER.phone}):\n`);
  for (let index = 0; index < count; index++) {
    const venue = await ensureVenue(marketplace.id, nasrCity.id, owner.id, index);
    try {
      const { code, invitation } = await createInvitation(
        { venueId: venue.id, staffId: owner.id, role: "OWNER", permissions: ALL_PERMISSIONS },
        phone,
        undefined, // The venue's default permissions, like an invite that doesn't pick any.
        systemClock,
      );
      const link = webLinks?.staffInvitation(code) ?? "(set WEB_URL for links)";
      console.log(`  ${venue.slug.padEnd(14)} ${code}  ${link}`);
      console.log(`  ${"".padEnd(14)} expires ${invitation.expiresAt.toISOString()}`);
    } catch (error) {
      // Typically ALREADY_A_MEMBER: the phone joined this venue on an earlier run.
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`  ${venue.slug.padEnd(14)} skipped: ${reason}`);
    }
  }
  console.log(`\nSeed owner sign-in: ${OWNER.phone} / ${OWNER.password}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  // The modules open Redis connections on import; close everything so the process can exit.
  await prisma.$disconnect();
  queueConnection.disconnect();
  cache.disconnect();
}
