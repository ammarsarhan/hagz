import { playersOn, type BookingRequest, type CancellationTier } from "@hagz/contracts";
import { HORIZON_DAYS, resolvedTiers } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { serviceFeeFor, type PricedAmenity } from "../domain/charges";
import { checkRange } from "../domain/rules";

// What a booking request is checked and priced against: the ground, its venue's settings, and the
// marketplace's VAT and commission. Read before the booking's transaction (reads of other modules'
// tables are allowed); the slots themselves are locked inside it.

const groundNotFound = () =>
  new AppError({
    code: "GROUND_NOT_FOUND",
    status: 404,
    detail: "No bookable ground with that id.",
  });

export const venuePaused = () =>
  new AppError({
    code: "VENUE_PAUSED",
    status: 409,
    detail: "This venue has paused bookings for now.",
  });

const groundResting = () =>
  new AppError({
    code: "GROUND_UNAVAILABLE",
    status: 409,
    detail: "This ground isn't taking bookings for now.",
  });

const amenityUnavailable = () =>
  new AppError({
    code: "AMENITY_NOT_AVAILABLE",
    status: 422,
    detail: "One of the extras isn't offered for a price at this venue.",
  });

const loadGround = (groundId: string) =>
  prisma.ground.findUnique({
    where: { id: groundId },
    select: {
      id: true,
      status: true,
      sport: true,
      size: true,
      settings: { select: { minimumSlots: true, maximumSlots: true } },
      venue: {
        select: {
          id: true,
          status: true,
          taxNumber: true,
          commissionRate: true,
          marketplace: {
            select: { currency: true, taxRate: true, commissionRate: true, serviceFee: true },
          },
          settings: {
            select: {
              autoConfirm: true,
              minimumNotice: true,
              paymentMode: true,
              depositPercent: true,
              paymentWindow: true,
              cancellationPolicy: true,
              cancellationTiers: true,
            },
          },
          amenities: {
            where: { price: { not: null } },
            select: { optionId: true, price: true, pricing: true },
          },
        },
      },
    },
  });

export interface BookingTerms {
  venueId: string;
  groundId: string;
  startsAt: Date;
  endsAt: Date;
  minimumSlots: number;
  maximumSlots: number;
  currency: string;
  // VAT in basis points: the marketplace's when the venue has a tax number, else 0.
  taxRate: number;
  commissionRate: number;
  autoConfirm: boolean;
  minimumNotice: number;
  paymentMode: "MANUAL" | "DEPOSIT" | "PLATFORM";
  depositPercent: number | null;
  paymentWindow: number | null;
  cancellationPolicy: "FLEXIBLE" | "MODERATE" | "STRICT" | "CUSTOM";
  cancellationTiers: CancellationTier[];
  amenities: PricedAmenity[];
  // Hagz's fee on the booking, at the marketplace's VAT; null when the marketplace charges none.
  serviceFee: { amount: number; taxRate: number } | null;
}

const serviceFeeOf = (
  ground: { sport: Parameters<typeof playersOn>[0]; size: Parameters<typeof playersOn>[1] },
  marketplace: { serviceFee: number; taxRate: number },
  startsAt: Date,
  endsAt: Date,
) => {
  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  const amount = serviceFeeFor(
    playersOn(ground.sport, ground.size),
    marketplace.serviceFee,
    minutes,
  );
  return amount > 0 ? { amount, taxRate: marketplace.taxRate } : null;
};

// Checks everything that doesn't need the slots: the ground and venue can take bookings, the time
// is inside the notice and horizon, and every extra is one the venue prices.
export const bookingTerms = async (request: BookingRequest, now: Date): Promise<BookingTerms> => {
  const ground = await loadGround(request.groundId);
  const venue = ground?.venue;
  if (!ground || ground.status === "DELETED" || !venue) throw groundNotFound();
  if (venue.status === "MAINTENANCE") throw venuePaused();
  if (venue.status !== "LIVE") throw groundNotFound();
  if (ground.status !== "ACTIVE") throw groundResting();

  const { settings } = venue;
  const settingsRow = ground.settings;
  if (!settings || !settingsRow) throw new Error(`Live ground ${ground.id} has no settings.`);
  const tiers = resolvedTiers(
    settings.cancellationPolicy,
    settings.cancellationTiers as CancellationTier[] | null,
  );
  if (!settings.cancellationPolicy || !tiers) {
    throw new Error(`Live venue ${venue.id} has no cancellation policy.`);
  }

  const startsAt = new Date(request.startsAt);
  const endsAt = new Date(request.endsAt);
  checkRange(startsAt, endsAt, {
    now,
    minimumNotice: settings.minimumNotice,
    horizonDays: HORIZON_DAYS,
  });

  const wanted = [...new Set(request.amenities)];
  const amenities = wanted.map((optionId) => {
    const offered = venue.amenities.find((amenity) => amenity.optionId === optionId);
    if (offered?.price == null || offered.pricing === null) throw amenityUnavailable();
    return { optionId, price: offered.price, pricing: offered.pricing };
  });

  return {
    venueId: venue.id,
    groundId: ground.id,
    startsAt,
    endsAt,
    minimumSlots: settingsRow.minimumSlots,
    maximumSlots: settingsRow.maximumSlots,
    currency: venue.marketplace.currency,
    taxRate: venue.taxNumber ? venue.marketplace.taxRate : 0,
    commissionRate: venue.commissionRate ?? venue.marketplace.commissionRate,
    autoConfirm: settings.autoConfirm,
    minimumNotice: settings.minimumNotice,
    paymentMode: settings.paymentMode,
    depositPercent: settings.depositPercent,
    paymentWindow: settings.paymentWindow,
    cancellationPolicy: settings.cancellationPolicy,
    cancellationTiers: tiers,
    amenities,
    serviceFee: serviceFeeOf(ground, venue.marketplace, startsAt, endsAt),
  };
};
