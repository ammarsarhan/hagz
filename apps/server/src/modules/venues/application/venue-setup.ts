import type { CreateVenue, VenueSetup } from "@hagz/contracts";
import type { Language, VenueStatus } from "@/generated/prisma/enums";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { VENUE_CREATED } from "../domain/events";
import { nameIn } from "../domain/names";
import { ALL_PERMISSIONS, DEFAULT_INVITATION_PERMISSIONS } from "../domain/permissions";
import { setupChecklist } from "../domain/setup";
import { generateSlug } from "../domain/slug";
import { accountSuspended, venueNotFound } from "./access";

// Creating a venue and reading its setup checklist (docs/onboarding.md, steps 1 and 2).

// A venue someone owns that isn't live yet. One at a time per owner, so drafts can't pile up; any
// number of live venues is fine.
const UNFINISHED: VenueStatus[] = ["DRAFT", "SUBMITTED", "PROVISIONING"];

export const unfinishedVenueExists = (venue: { id: string; status: VenueStatus }) =>
  new AppError({
    code: "UNFINISHED_VENUE_EXISTS",
    status: 409,
    detail: "You already have a venue that isn't live yet. Finish it first.",
    // `status` is the problem's HTTP status (RFC 9457), so the venue's goes in its own member.
    extensions: { venueId: venue.id, venueStatus: venue.status },
  });

export const locationNotFound = () =>
  new AppError({
    code: "LOCATION_NOT_FOUND",
    status: 422,
    detail: "There's no such area, or Hagz doesn't operate there yet.",
  });

export const locationOutsideMarketplace = () =>
  new AppError({
    code: "LOCATION_OUTSIDE_MARKETPLACE",
    status: 422,
    detail: "The pin isn't in the same country as the area.",
  });

// Candidates checked per creation. A clash needs one of these to match one of the existing slugs
// (31^8 possible), so in practice the first is free; the unique index still guards the rare race.
const SLUG_CANDIDATES = 5;

const freeSlug = async (tx: Tx) => {
  const candidates = Array.from({ length: SLUG_CANDIDATES }, () => generateSlug());
  const taken = await tx.venue.findMany({
    where: { slug: { in: candidates } },
    select: { slug: true },
  });
  const used = new Set(taken.map((venue) => venue.slug));
  const slug = candidates.find((candidate) => !used.has(candidate));
  if (!slug) throw new Error("No free venue slug among the candidates");
  return slug;
};

interface Bounds {
  minimumLatitude: number | null;
  maximumLatitude: number | null;
  minimumLongitude: number | null;
  maximumLongitude: number | null;
}

// A rough box per marketplace (user, 2026-11-12): it catches a pin dropped in the wrong country.
// No box means no check.
export const insideBounds = (
  bounds: Bounds,
  { latitude, longitude }: CreateVenue["coordinates"],
) => {
  const { minimumLatitude, maximumLatitude, minimumLongitude, maximumLongitude } = bounds;
  if (
    minimumLatitude === null ||
    maximumLatitude === null ||
    minimumLongitude === null ||
    maximumLongitude === null
  ) {
    return true;
  }
  return (
    latitude >= minimumLatitude &&
    latitude <= maximumLatitude &&
    longitude >= minimumLongitude &&
    longitude <= maximumLongitude
  );
};

// A signed-in staff account creates a DRAFT and becomes its OWNER. The name is stored in the
// owner's app language; admins add the other language while provisioning.
export const createVenue = async (
  staffId: string,
  input: CreateVenue,
  language: Language,
): Promise<VenueSetup> => {
  const venueId = await transaction(async (tx) => {
    // Locking the staff row serialises two creations by the same person, so both can't pass the
    // one-unfinished-venue check below. Transfers of ownership take the same lock (PR 2.7).
    const [staff] = await tx.$queryRaw<
      { status: string; deletedAt: Date | null; language: Language }[]
    >`SELECT status, "deletedAt", language FROM "Staff" WHERE id = ${staffId}::uuid FOR UPDATE`;
    if (staff?.status !== "ACTIVE" || staff.deletedAt !== null) throw accountSuspended();

    const unfinished = await tx.venueMembership.findFirst({
      where: { staffId, role: "OWNER", venue: { status: { in: UNFINISHED } } },
      select: { venue: { select: { id: true, status: true } } },
    });
    if (unfinished) throw unfinishedVenueExists(unfinished.venue);

    const location = await tx.location.findUnique({
      where: { id: input.locationId },
      select: {
        marketplaceId: true,
        marketplace: {
          select: {
            isActive: true,
            minimumLatitude: true,
            maximumLatitude: true,
            minimumLongitude: true,
            maximumLongitude: true,
          },
        },
      },
    });
    if (!location?.marketplace.isActive) throw locationNotFound();
    if (!insideBounds(location.marketplace, input.coordinates)) throw locationOutsideMarketplace();

    const venue = await tx.venue.create({
      data: {
        marketplaceId: location.marketplaceId,
        locationId: input.locationId,
        slug: await freeSlug(tx),
        placeId: input.placeId ?? null,
        translations: { create: { language: staff.language, name: input.name } },
        settings: { create: { defaultPermissions: DEFAULT_INVITATION_PERMISSIONS } },
        memberships: { create: { staffId, role: "OWNER", permissions: ALL_PERMISSIONS } },
      },
      select: { id: true },
    });
    const { latitude, longitude } = input.coordinates;
    await tx.$executeRaw`
      UPDATE "Venue"
      SET coordinates = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      WHERE id = ${venue.id}::uuid`;
    await tx.venueEvent.create({
      data: {
        venueId: venue.id,
        type: VENUE_CREATED,
        staffId,
        data: {
          name: input.name,
          language: staff.language,
          locationId: input.locationId,
          coordinates: input.coordinates,
          placeId: input.placeId ?? null,
        },
      },
    });
    return venue.id;
  });
  return venueSetup(venueId, language);
};

// The checklist and the venue it belongs to, for the setup screen and the draft card.
export const venueSetup = async (venueId: string, language: Language): Promise<VenueSetup> => {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      slug: true,
      status: true,
      phone: true,
      taxNumber: true,
      translations: { select: { language: true, name: true, description: true, address: true } },
      settings: { select: { cancellationPolicy: true } },
      _count: { select: { amenities: true } },
    },
  });
  if (!venue) throw venueNotFound();
  // Prisma can't read PostGIS columns; whether the pin is set is enough here.
  const [pin] = await prisma.$queryRaw<{ hasPin: boolean }[]>`
    SELECT coordinates IS NOT NULL AS "hasPin" FROM "Venue" WHERE id = ${venueId}::uuid`;
  return {
    venue: {
      id: venue.id,
      slug: venue.slug,
      status: venue.status,
      name: nameIn(venue.translations, language),
    },
    ...setupChecklist({
      status: venue.status,
      phone: venue.phone,
      translations: venue.translations,
      hasPin: pin?.hasPin ?? false,
      cancellationPolicy: venue.settings?.cancellationPolicy ?? null,
      amenityCount: venue._count.amenities,
      taxNumber: venue.taxNumber,
    }),
  };
};
