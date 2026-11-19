import {
  AmenityIcon,
  type PublicGround,
  type PublicVenue,
  type VenueAvailability,
  type VenueAvailabilityQuery,
} from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import type { Language, PriceTier } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { storage } from "@/platform/storage/storage";
import { cancellationSummary } from "../domain/cancellation-summary";
import { nameIn, placeOf, translationIn } from "../domain/names";
import { settingsView } from "../domain/settings";
import { HORIZON_DAYS } from "../domain/slots";
import { venueNotFound } from "./access";
import { venueLayout } from "./layout";
import { pinOf, settingsSelect, storedSettings } from "./venue-edit";

// The venue page (PR 3.2): a venue as anyone sees it, signed in or not, and a day of its free times.
// Only venues that have gone live are public: LIVE, or paused (MAINTENANCE), which shows with a
// notice and no free times. Any other status answers like a slug that doesn't exist.

const PUBLIC = ["LIVE", "MAINTENANCE"] as const;

const names = { translations: { select: { language: true, name: true } } } as const;

const groundSelect = {
  id: true,
  sport: true,
  size: true,
  surface: true,
  environment: true,
  status: true,
  basePrice: true,
  peakPrice: true,
  discountPrice: true,
  ...names,
  settings: { select: { minimumSlots: true, maximumSlots: true } },
  schedules: { select: { hours: true } },
} as const satisfies Prisma.GroundSelect;

type GroundRow = Prisma.GroundGetPayload<{ select: typeof groundSelect }>;

// The cheapest hour the ground's week has. The API never saves hours in a tier without a price.
const priceFrom = (ground: GroundRow): number | null => {
  const prices = { BASE: ground.basePrice, PEAK: ground.peakPrice, DISCOUNT: ground.discountPrice };
  const used = ground.schedules.flatMap((day) =>
    Object.values((day.hours ?? {}) as Record<string, PriceTier>).map((tier) => prices[tier]),
  );
  const priced = used.filter((price): price is number => price !== null);
  return priced.length > 0 ? Math.min(...priced) : null;
};

const presentGround = (ground: GroundRow, language: Language): PublicGround => ({
  id: ground.id,
  name: nameIn(ground.translations, language),
  sport: ground.sport,
  size: ground.size,
  surface: ground.surface,
  environment: ground.environment,
  status: ground.status === "ACTIVE" ? "ACTIVE" : "MAINTENANCE",
  priceFrom: priceFrom(ground),
  minimumSlots: ground.settings?.minimumSlots ?? 1,
  maximumSlots: ground.settings?.maximumSlots ?? 3,
});

export const publicVenue = async (slug: string, language: Language): Promise<PublicVenue> => {
  const venue = await prisma.venue.findFirst({
    where: { slug, status: { in: [...PUBLIC] } },
    select: {
      id: true,
      slug: true,
      status: true,
      phone: true,
      averageRating: true,
      reviewCount: true,
      marketplace: { select: { code: true, currency: true, timezone: true } },
      location: { select: { ...names, parent: { select: names } } },
      translations: { select: { language: true, name: true, description: true, address: true } },
      settings: { select: settingsSelect },
      amenities: {
        orderBy: { option: { key: "asc" } },
        select: {
          price: true,
          pricing: true,
          option: { select: { id: true, key: true, icon: true, ...names } },
        },
      },
      media: {
        where: { type: "IMAGE", status: "READY" },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, key: true },
      },
      grounds: {
        where: { status: { not: "DELETED" } },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: groundSelect,
      },
    },
  });
  if (!venue) throw venueNotFound();

  const [coordinates, layout] = await Promise.all([pinOf(prisma, venue.id), venueLayout(venue.id)]);
  const text = translationIn(venue.translations, language);
  const settings = settingsView(storedSettings(venue.settings));
  const policy = settings.cancellationPolicy;
  const tiers = settings.cancellationTiers;

  return {
    id: venue.id,
    slug: venue.slug,
    status: venue.status === "LIVE" ? "LIVE" : "MAINTENANCE",
    name: text?.name ?? null,
    description: text?.description ?? null,
    phone: venue.phone,
    marketplace: venue.marketplace,
    location: {
      area: placeOf(venue.location, language),
      address: text?.address ?? null,
      coordinates,
    },
    photos: venue.media.map((photo) => ({ id: photo.id, url: storage.publicUrl(photo.key) })),
    rating: {
      average: venue.averageRating === null ? null : venue.averageRating.toNumber(),
      count: venue.reviewCount,
    },
    amenities: venue.amenities.map(({ option, price, pricing }) => ({
      id: option.id,
      key: option.key,
      name: nameIn(option.translations, language),
      icon: AmenityIcon.parse(option.icon),
      price,
      pricing,
    })),
    grounds: venue.grounds.map((ground) => presentGround(ground, language)),
    // A venue that hasn't drawn its map has none to show, rather than the editor's suggested grid.
    layout: layout.saved
      ? {
          columns: layout.columns,
          rows: layout.rows,
          grounds: layout.grounds,
          amenities: layout.amenities,
          entrances: layout.entrances,
        }
      : null,
    booking: {
      instantConfirmation: settings.autoConfirm,
      minimumNotice: settings.minimumNotice,
      payment: { mode: settings.paymentMode, depositPercent: settings.depositPercent },
      cancellation:
        policy && tiers ? { policy, tiers, summary: cancellationSummary(tiers, language) } : null,
      loyalty: settings.loyalty,
    },
  };
};

// A local day of the venue's free times. Postgres turns the date into the day's two instants in the
// venue's timezone (`AT TIME ZONE` knows its DST, so a day can be 23 or 25 hours), like the staff
// calendar's day (day-slots.ts). A slot is bookable when it's AVAILABLE, on an ACTIVE ground, and
// starts after the venue's minimum notice; booking checks all of it again, so a slot that goes in
// between is only a stale screen.
export const venueAvailability = async (
  slug: string,
  query: VenueAvailabilityQuery,
  clock: Clock = systemClock,
): Promise<VenueAvailability> => {
  const venue = await prisma.venue.findFirst({
    where: { slug, status: { in: [...PUBLIC] } },
    select: {
      id: true,
      status: true,
      marketplace: { select: { currency: true, timezone: true } },
      settings: { select: settingsSelect },
    },
  });
  if (!venue) throw venueNotFound();
  const { currency, timezone } = venue.marketplace;
  const now = clock.now();

  const [days] = await prisma.$queryRaw<{ first: string; last: string }[]>`
    SELECT (${now}::timestamptz AT TIME ZONE ${timezone})::date::text AS first,
           ((${now}::timestamptz + make_interval(days => ${HORIZON_DAYS}::int)) AT TIME ZONE ${timezone})::date::text AS last`;
  if (!days) throw new Error("Postgres returned no days.");
  const date = query.date ?? days.first;

  const [bounds] = await prisma.$queryRaw<{ from: Date; to: Date }[]>`
    SELECT (${date}::date::timestamp AT TIME ZONE ${timezone}) AS "from",
           ((${date}::date + 1)::timestamp AT TIME ZONE ${timezone}) AS "to"`;
  if (!bounds) throw new Error("Postgres returned no day bounds.");

  const notice = settingsView(storedSettings(venue.settings)).minimumNotice;
  const opens = new Date(now.getTime() + notice * 60_000);
  const slots =
    venue.status === "LIVE"
      ? await prisma.groundSlot.findMany({
          where: {
            venueId: venue.id,
            status: "AVAILABLE",
            ground: { status: "ACTIVE" },
            startsAt: { gte: opens > bounds.from ? opens : bounds.from, lt: bounds.to },
          },
          orderBy: [{ startsAt: "asc" }, { groundId: "asc" }],
          select: {
            id: true,
            groundId: true,
            startsAt: true,
            endsAt: true,
            tier: true,
            price: true,
          },
        })
      : [];

  return {
    date,
    days,
    timezone,
    currency,
    slots: slots.map((slot) => ({
      ...slot,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    })),
  };
};
