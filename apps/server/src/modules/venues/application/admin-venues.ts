import { AmenityIcon } from "@hagz/contracts";
import type {
  AdminVenue,
  AdminVenueAmenities,
  AdminVenueLocation,
  AdminVenueQuery,
  VenueStatus,
  VenueTranslation,
} from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import { placeOf } from "../domain/names";
import { venueNotFound } from "./access";
import { listSentInvitations } from "./invitations";
import { listMembers } from "./members";
import { listPhotos } from "./venue-media";
import { pinOf } from "./venue-edit";

// The admin Venues table: every venue in any status, newest first, a page at a time. Ids are UUIDv7,
// so ordering by id is ordering by creation, and the last id on a page is the cursor for the next.

const STATUSES: VenueStatus[] = ["DRAFT", "SUBMITTED", "PROVISIONING", "LIVE", "MAINTENANCE"];

const place = { translations: { select: { language: true, name: true } } } as const;

export const adminVenueSelect = {
  id: true,
  slug: true,
  status: true,
  createdAt: true,
  marketplace: { select: { id: true, code: true } },
  translations: { select: { language: true, name: true } },
  location: { select: { ...place, parent: { select: place } } },
  requestedArea: true,
  memberships: {
    where: { role: "OWNER" },
    select: { staff: { select: { id: true, name: true, phone: true } } },
  },
  _count: { select: { grounds: { where: { status: { not: "DELETED" } } } } },
} as const satisfies Prisma.VenueSelect;

type Row = Prisma.VenueGetPayload<{ select: typeof adminVenueSelect }>;

export const presentAdminVenue = (venue: Row): AdminVenue => {
  const exact = (language: "EN" | "AR") =>
    venue.translations.find((t) => t.language === language)?.name ?? null;
  const owner = venue.memberships[0]?.staff ?? null;
  return {
    id: venue.id,
    slug: venue.slug,
    names: { en: exact("EN"), ar: exact("AR") },
    status: venue.status,
    marketplace: venue.marketplace,
    area: placeOf(venue.location, "EN"),
    requestedArea: venue.requestedArea,
    owner,
    groundCount: venue._count.grounds,
    createdAt: venue.createdAt.toISOString(),
  };
};

// Prisma escapes nothing in `contains`, so % and _ would act as wildcards.
const literal = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

export const listAdminVenues = async ({ status, q, cursor, limit }: AdminVenueQuery) => {
  const search: Prisma.VenueWhereInput = q
    ? {
        OR: [
          {
            translations: {
              some: { name: { contains: literal(q), mode: "insensitive" } },
            },
          },
          { slug: { contains: literal(q.toLowerCase()) } },
        ],
      }
    : {};

  const [rows, groups] = await Promise.all([
    prisma.venue.findMany({
      where: { ...search, ...(status && { status }), ...(cursor && { id: { lt: cursor } }) },
      orderBy: { id: "desc" },
      take: limit + 1,
      select: adminVenueSelect,
    }),
    // For the status tabs: how many match the search in each status.
    prisma.venue.groupBy({ by: ["status"], where: search, _count: true }),
  ]);

  const more = rows.length > limit;
  const data = (more ? rows.slice(0, limit) : rows).map(presentAdminVenue);
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, groups.find((g) => g.status === s)?._count ?? 0]),
  ) as Record<VenueStatus, number>;
  return { data, nextCursor: more ? (data.at(-1)?.id ?? null) : null, counts };
};

// One venue, for the header of its admin dashboard.
export const getAdminVenue = async (id: string): Promise<AdminVenue> => {
  const venue = await prisma.venue.findUnique({ where: { id }, select: adminVenueSelect });
  if (!venue) throw venueNotFound();
  return presentAdminVenue(venue);
};

const mustExist = async (id: string) => {
  const venue = await prisma.venue.findUnique({ where: { id }, select: { id: true } });
  if (!venue) throw venueNotFound();
};

// A venue's Team tab: the same lists its staff see (members with their permissions, the owner
// first; invitations still open), for any venue in any status.
export const adminVenueMembers = async (id: string) => {
  await mustExist(id);
  return listMembers(id);
};

export const adminVenueInvitations = async (id: string) => {
  await mustExist(id);
  return listSentInvitations(id);
};

// A venue's Details tab: what players read in each language, English first. A language nobody has
// written yet isn't in the list.
export const adminVenueTranslations = async (id: string): Promise<VenueTranslation[]> => {
  await mustExist(id);
  const rows = await prisma.venueTranslation.findMany({
    where: { venueId: id },
    select: { language: true, name: true, description: true, address: true },
  });
  return (["EN", "AR"] as const).flatMap((language) =>
    rows.filter((row) => row.language === language),
  );
};

// A venue's photos as players see them: ready ones only, in order, the cover first. An upload still
// on its way isn't on the venue page, so it isn't here either.
export const adminVenuePhotos = async (id: string) => {
  await mustExist(id);
  return (await listPhotos(id)).filter((photo) => photo.status === "READY");
};

const written = (place: { translations: { language: string }[] }, language: "EN" | "AR") =>
  place.translations.some((t) => t.language === language);

// A venue's Location section: its marketplace, the pin, and the area it's listed under ("Nasr City, Cairo", in both
// languages) or the one its owner asked for.
export const adminVenueLocation = async (id: string): Promise<AdminVenueLocation> => {
  const venue = await prisma.venue.findUnique({
    where: { id },
    select: {
      requestedArea: true,
      marketplace: { select: { id: true, code: true, ...place } },
      location: { select: { id: true, ...place, parent: { select: place } } },
    },
  });
  if (!venue) throw venueNotFound();
  const { marketplace } = venue;
  const exact = (language: "EN" | "AR") =>
    marketplace.translations.find((t) => t.language === language)?.name ?? null;
  return {
    marketplace: {
      id: marketplace.id,
      code: marketplace.code,
      names: { en: exact("EN"), ar: exact("AR") },
    },
    coordinates: await pinOf(prisma, id),
    area: venue.location && {
      id: venue.location.id,
      // Only a name the area has in that language: placeOf falls back to the other one, which
      // would hide a missing translation from the admin.
      names: {
        en: written(venue.location, "EN") ? placeOf(venue.location, "EN") : null,
        ar: written(venue.location, "AR") ? placeOf(venue.location, "AR") : null,
      },
    },
    requestedArea: venue.requestedArea,
  };
};

// A venue's Amenities section: what it offers, with each option's name and icon and the price the
// venue charges, by English name. The currency is the marketplace's.
export const adminVenueAmenities = async (id: string): Promise<AdminVenueAmenities> => {
  const venue = await prisma.venue.findUnique({
    where: { id },
    select: {
      marketplace: { select: { currency: true } },
      amenities: {
        select: {
          price: true,
          pricing: true,
          option: {
            select: {
              id: true,
              key: true,
              icon: true,
              isActive: true,
              translations: { select: { language: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!venue) throw venueNotFound();
  const amenities = venue.amenities.map(({ option, price, pricing }) => {
    const exact = (language: "EN" | "AR") =>
      option.translations.find((t) => t.language === language)?.name ?? null;
    return {
      optionId: option.id,
      key: option.key,
      icon: AmenityIcon.parse(option.icon),
      names: { en: exact("EN"), ar: exact("AR") },
      isActive: option.isActive,
      price,
      pricing,
    };
  });
  amenities.sort((a, b) => (a.names.en ?? a.key).localeCompare(b.names.en ?? b.key, "en"));
  return { currency: venue.marketplace.currency, amenities };
};
