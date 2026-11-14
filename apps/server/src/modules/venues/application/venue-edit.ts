import type {
  SetVenueAmenities,
  StaffVenueDetail,
  UpdateVenue,
  UpdateVenueSettings,
  VenueTranslationInput,
} from "@hagz/contracts";
import { Prisma } from "@/generated/prisma/client";
import type { Language, VenueStatus } from "@/generated/prisma/enums";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { requirePhoneNumber } from "@/platform/phone/phone";
import { editable, lockedDetail, type EditPart } from "../domain/edit-rules";
import { DEFAULT_INVITATION_PERMISSIONS } from "../domain/permissions";
import {
  VENUE_AMENITIES_CHANGED,
  VENUE_DETAILS_CHANGED,
  VENUE_LOCATION_CHANGED,
  VENUE_SETTINGS_CHANGED,
  VENUE_TRANSLATION_CHANGED,
} from "../domain/events";
import {
  changedSettings,
  mergeSettings,
  settingsView,
  type StoredSettings,
} from "../domain/settings";
import { nameIn } from "../domain/names";
import { venueNotFound, venueStatusConflict, type VenueAccess } from "./access";
import { checkPin, locationOutsideMarketplace } from "./pin-checks";
import { locationNotFound } from "./venue-setup";

// Editing a venue during setup and after it goes live (docs/onboarding.md): details, location,
// translations, settings and amenities. Every edit locks the venue row, so it can't race a submit,
// checks what the venue's status allows, and records a VenueEvent with the previous and new values.

interface Locked {
  status: VenueStatus;
  marketplaceId: string;
}

export const lockForEdit = async (tx: Tx, venueId: string, part: EditPart): Promise<Locked> => {
  const [venue] = await tx.$queryRaw<Locked[]>`
    SELECT status, "marketplaceId" FROM "Venue" WHERE id = ${venueId}::uuid FOR UPDATE`;
  if (!venue) throw venueNotFound();
  if (!editable(venue.status, part))
    throw venueStatusConflict(venue.status, lockedDetail(venue.status));
  return venue;
};

export const pinOf = async (db: Tx | typeof prisma, venueId: string) => {
  const [pin] = await db.$queryRaw<{ latitude: number | null; longitude: number | null }[]>`
    SELECT ST_Y(coordinates::geometry) AS latitude, ST_X(coordinates::geometry) AS longitude
    FROM "Venue" WHERE id = ${venueId}::uuid`;
  return pin?.latitude == null || pin.longitude == null
    ? null
    : { latitude: pin.latitude, longitude: pin.longitude };
};

const settingsSelect = {
  autoConfirm: true,
  minimumNotice: true,
  paymentMode: true,
  depositPercent: true,
  cancellationPolicy: true,
  cancellationTiers: true,
  loyaltyStamps: true,
  loyaltyWindow: true,
} as const satisfies Prisma.VenueSettingsSelect;

type SettingsRow = Prisma.VenueSettingsGetPayload<{ select: typeof settingsSelect }>;

// What a venue without a settings row (made before rows were created with venues) behaves as.
const DEFAULT_SETTINGS: StoredSettings = {
  autoConfirm: true,
  minimumNotice: 60,
  paymentMode: "MANUAL",
  depositPercent: null,
  cancellationPolicy: null,
  cancellationTiers: null,
  loyaltyStamps: null,
  loyaltyWindow: null,
};

const stored = (row: SettingsRow | null): StoredSettings =>
  row
    ? { ...row, cancellationTiers: row.cancellationTiers as StoredSettings["cancellationTiers"] }
    : DEFAULT_SETTINGS;

const names = { translations: { select: { language: true, name: true } } } as const;

// Everything the setup and edit screens show, with the area named in `display` (the app's
// language): the area itself and the top of its tree, as the area picker shows it.
export const venueDetail = async (
  venueId: string,
  display: Language,
): Promise<StaffVenueDetail> => {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      slug: true,
      status: true,
      phone: true,
      taxNumber: true,
      placeId: true,
      locationId: true,
      requestedArea: true,
      marketplace: { select: { code: true, currency: true } },
      location: {
        select: {
          ...names,
          parent: {
            select: { ...names, parent: { select: { ...names, parent: { select: names } } } },
          },
        },
      },
      translations: {
        orderBy: { language: "asc" },
        select: { language: true, name: true, description: true, address: true },
      },
      settings: { select: settingsSelect },
      amenities: { select: { optionId: true, price: true, pricing: true } },
    },
  });
  if (!venue) throw venueNotFound();
  const area = venue.location;
  const top = area?.parent?.parent?.parent ?? area?.parent?.parent ?? area?.parent;
  return {
    id: venue.id,
    slug: venue.slug,
    status: venue.status,
    phone: venue.phone,
    taxNumber: venue.taxNumber,
    marketplace: venue.marketplace,
    location: {
      id: venue.locationId,
      name: area ? nameIn(area.translations, display) : null,
      within: top ? nameIn(top.translations, display) : null,
      requestedArea: venue.requestedArea,
      coordinates: await pinOf(prisma, venueId),
      placeId: venue.placeId,
    },
    translations: venue.translations,
    settings: settingsView(stored(venue.settings)),
    amenities: venue.amenities,
  };
};

const event = (
  tx: Tx,
  venueId: string,
  staffId: string,
  type: string,
  data: Prisma.InputJsonValue,
) => tx.venueEvent.create({ data: { venueId, staffId, type, data } });

// Phone and tax number (operations: still editable while provisioning, when Hagz checks the tax
// number), and the location (listing).
export const updateVenue = async (actor: VenueAccess, input: UpdateVenue, display: Language) => {
  const phone = input.phone == null ? input.phone : requirePhoneNumber(input.phone);
  await transaction(async (tx) => {
    const venue = await lockForEdit(tx, actor.venueId, input.location ? "listing" : "operations");
    const current = await tx.venue.findUniqueOrThrow({
      where: { id: actor.venueId },
      select: {
        phone: true,
        taxNumber: true,
        placeId: true,
        locationId: true,
        requestedArea: true,
      },
    });

    const details: Record<string, { previous: unknown; next: unknown }> = {};
    if (phone !== undefined && phone !== current.phone) {
      details.phone = { previous: current.phone, next: phone };
    }
    if (input.taxNumber !== undefined && input.taxNumber !== current.taxNumber) {
      details.taxNumber = { previous: current.taxNumber, next: input.taxNumber };
    }
    if (Object.keys(details).length > 0) {
      await tx.venue.update({
        where: { id: actor.venueId },
        data: { phone, taxNumber: input.taxNumber },
      });
      await event(tx, actor.venueId, actor.staffId, VENUE_DETAILS_CHANGED, {
        changes: details,
      } as Prisma.InputJsonValue);
    }

    if (input.location) {
      const { coordinates, placeId, locationId } = input.location;
      const location = await tx.location.findUnique({
        where: { id: locationId },
        select: {
          marketplaceId: true,
          marketplace: { select: { isActive: true } },
        },
      });
      if (!location?.marketplace.isActive) throw locationNotFound();
      // A venue's currency, VAT, amenities and payouts belong to its marketplace, so a new area
      // must be in the same one (docs/onboarding.md, "Edits after going live").
      if (location.marketplaceId !== venue.marketplaceId) throw locationOutsideMarketplace();
      await checkPin(tx, { marketplaceId: venue.marketplaceId, locationId, pin: coordinates });

      const previous = {
        coordinates: await pinOf(tx, actor.venueId),
        placeId: current.placeId,
        locationId: current.locationId,
        requestedArea: current.requestedArea,
      };
      // Picking an area from the list replaces any the owner asked for.
      await tx.venue.update({
        where: { id: actor.venueId },
        data: { placeId, locationId, requestedArea: null },
      });
      await tx.$executeRaw`
        UPDATE "Venue"
        SET coordinates = ST_SetSRID(ST_MakePoint(${coordinates.longitude}, ${coordinates.latitude}), 4326)::geography
        WHERE id = ${actor.venueId}::uuid`;
      await event(tx, actor.venueId, actor.staffId, VENUE_LOCATION_CHANGED, {
        previous,
        next: { coordinates, placeId, locationId },
      });
    }
  });
  return venueDetail(actor.venueId, display);
};

// One language's name, description and address. The app writes the owner's language; admins fill
// in the other while provisioning (their own route).
export const putTranslation = async (
  actor: VenueAccess,
  language: Language,
  input: VenueTranslationInput,
  display: Language,
) => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "listing");
    await writeTranslation(tx, actor.venueId, language, input, { staffId: actor.staffId });
  });
  return venueDetail(actor.venueId, display);
};

export const writeTranslation = async (
  tx: Tx,
  venueId: string,
  language: Language,
  input: VenueTranslationInput,
  actor: { staffId: string } | { adminId: string },
) => {
  const previous = await tx.venueTranslation.findUnique({
    where: { venueId_language: { venueId, language } },
    select: { name: true, description: true, address: true },
  });
  const next = {
    name: input.name,
    description: input.description === "" ? null : input.description,
    address: input.address === "" ? null : input.address,
  };
  if (previous && JSON.stringify(previous) === JSON.stringify(next)) return;
  await tx.venueTranslation.upsert({
    where: { venueId_language: { venueId, language } },
    create: { venueId, language, ...next },
    update: next,
  });
  await tx.venueEvent.create({
    data: {
      venueId,
      ...actor,
      type: VENUE_TRANSLATION_CHANGED,
      data: { language, previous, next },
    },
  });
};

export const updateSettings = async (
  actor: VenueAccess,
  change: UpdateVenueSettings,
  display: Language,
) => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const row = await tx.venueSettings.findUnique({
      where: { venueId: actor.venueId },
      select: settingsSelect,
    });
    const previous = stored(row);
    const next = mergeSettings(previous, change);
    const changes = changedSettings(previous, next);
    if (Object.keys(changes).length === 0) return;
    const data = { ...next, cancellationTiers: next.cancellationTiers ?? Prisma.DbNull };
    await tx.venueSettings.upsert({
      where: { venueId: actor.venueId },
      // A venue without settings gets the platform's default invitation permissions with them.
      create: {
        venueId: actor.venueId,
        defaultPermissions: DEFAULT_INVITATION_PERMISSIONS,
        ...data,
      },
      update: data,
    });
    await event(tx, actor.venueId, actor.staffId, VENUE_SETTINGS_CHANGED, {
      changes,
    } as Prisma.InputJsonValue);
  });
  return venueDetail(actor.venueId, display);
};

export const amenityNotAvailable = (optionIds: string[]) =>
  new AppError({
    code: "AMENITY_NOT_AVAILABLE",
    status: 422,
    detail: "Some of these amenities aren't offered in this venue's country.",
    extensions: { optionIds },
  });

// The whole set at once, as the pill screen saves it. An option the marketplace has since retired
// can stay if the venue already had it, but can't be newly picked.
export const setAmenities = async (
  actor: VenueAccess,
  input: SetVenueAmenities,
  display: Language,
) => {
  await transaction(async (tx) => {
    const venue = await lockForEdit(tx, actor.venueId, "operations");
    const previous = await tx.venueAmenity.findMany({
      where: { venueId: actor.venueId },
      orderBy: { optionId: "asc" },
      select: { optionId: true, price: true, pricing: true },
    });
    const had = new Set(previous.map((amenity) => amenity.optionId));
    const wanted = input.amenities.map((amenity) => amenity.optionId);
    const options = await tx.amenityOption.findMany({
      where: { id: { in: wanted }, marketplaceId: venue.marketplaceId },
      select: { id: true, isActive: true },
    });
    const usable = new Set(options.filter((o) => o.isActive || had.has(o.id)).map((o) => o.id));
    const refused = wanted.filter((id) => !usable.has(id));
    if (refused.length > 0) throw amenityNotAvailable(refused);

    const next = [...input.amenities].sort((a, b) => a.optionId.localeCompare(b.optionId));
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    await tx.venueAmenity.deleteMany({ where: { venueId: actor.venueId } });
    await tx.venueAmenity.createMany({
      data: next.map((amenity) => ({
        venueId: actor.venueId,
        marketplaceId: venue.marketplaceId,
        ...amenity,
      })),
    });
    await event(tx, actor.venueId, actor.staffId, VENUE_AMENITIES_CHANGED, { previous, next });
  });
  return venueDetail(actor.venueId, display);
};
