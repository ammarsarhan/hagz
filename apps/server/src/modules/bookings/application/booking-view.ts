import type { Booking, BookingCharge, CancellationTier } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { nameIn, pinOf, placeOf, translationIn } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import type { ChargeLine } from "../domain/charges";
import { endingOf, endingSelect, ENDING_EVENTS } from "./booking-ending";
import { bookingCheckIn } from "./check-in";
import { moveFor } from "./move-response";
import { bookerListing } from "./listings";

// How a booking is shown to the player who made it.

const names = { translations: { select: { language: true, name: true } } } as const;

// Amenity names for charge lines, by option id.
export const amenityNames = async (optionIds: readonly string[], language: Language) => {
  if (optionIds.length === 0) return new Map<string, string | null>();
  const options = await prisma.amenityOption.findMany({
    where: { id: { in: [...optionIds] } },
    select: { id: true, ...names },
  });
  return new Map(options.map((option) => [option.id, nameIn(option.translations, language)]));
};

interface ChargeRow extends Omit<ChargeLine, "type" | "taxRate"> {
  type: BookingCharge["type"];
}

export const presentCharge = (
  line: ChargeRow,
  amenityName: (optionId: string) => string | null,
): BookingCharge => ({
  type: line.type,
  startsAt: line.startsAt?.toISOString() ?? null,
  tier: line.tier,
  amenity: line.optionId
    ? { id: line.optionId, name: amenityName(line.optionId), pricing: line.pricing }
    : null,
  amount: line.amount,
  taxAmount: line.taxAmount,
});

export const bookingView = async (bookingId: string, language: Language): Promise<Booking> => {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      id: true,
      code: true,
      status: true,
      startsAt: true,
      endsAt: true,
      expiresAt: true,
      creatorId: true,
      regularId: true,
      checkedInAt: true,
      total: true,
      depositAmount: true,
      paymentMode: true,
      cancellationPolicy: true,
      cancellationTiers: true,
      note: true,
      createdAt: true,
      cancellation: endingSelect.cancellation,
      events: {
        where: { type: { in: ENDING_EVENTS } },
        select: { type: true, data: true },
      },
      venue: {
        select: {
          id: true,
          slug: true,
          phone: true,
          translations: { select: { language: true, name: true, address: true } },
          marketplace: { select: { currency: true, timezone: true } },
          location: { select: { ...names, parent: { select: names } } },
        },
      },
      ground: { select: { id: true, sport: true, size: true, ...names } },
      payments: {
        where: { status: "SUCCEEDED" },
        select: {
          amount: true,
          refunds: { where: { status: "SUCCEEDED" }, select: { amount: true } },
        },
      },
      charges: {
        orderBy: [{ type: "asc" }, { startsAt: "asc" }, { id: "asc" }],
        select: {
          type: true,
          startsAt: true,
          tier: true,
          optionId: true,
          pricing: true,
          amount: true,
          taxAmount: true,
          option: { select: names },
        },
      },
    },
  });
  const optionNames = new Map(
    booking.charges.flatMap((charge) =>
      charge.optionId && charge.option
        ? [[charge.optionId, nameIn(charge.option.translations, language)] as const]
        : [],
    ),
  );
  return {
    id: booking.id,
    code: booking.code,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    venue: {
      id: booking.venue.id,
      slug: booking.venue.slug,
      name: nameIn(booking.venue.translations, language),
      timezone: booking.venue.marketplace.timezone,
      area: placeOf(booking.venue.location, language),
      address: translationIn(booking.venue.translations, language)?.address ?? null,
      coordinates: await pinOf(prisma, booking.venue.id),
      phone: booking.venue.phone,
    },
    ground: {
      id: booking.ground.id,
      name: nameIn(booking.ground.translations, language),
      sport: booking.ground.sport,
      size: booking.ground.size,
    },
    currency: booking.venue.marketplace.currency,
    total: booking.total,
    tax: booking.charges.reduce((sum, charge) => sum + charge.taxAmount, 0),
    paymentMode: booking.paymentMode,
    deposit: booking.depositAmount,
    paid: booking.payments.reduce(
      (sum, payment) =>
        sum +
        payment.amount -
        payment.refunds.reduce((refunded, refund) => refunded + refund.amount, 0),
      0,
    ),
    charges: booking.charges.map((charge) =>
      presentCharge(charge, (id) => optionNames.get(id) ?? null),
    ),
    cancellation: {
      policy: booking.cancellationPolicy,
      tiers: booking.cancellationTiers as CancellationTier[],
    },
    note: booking.note,
    listing: await bookerListing(booking.id),
    checkIn: bookingCheckIn(booking),
    move: await moveFor(booking.id, language),
    ...endingOf(booking),
    createdAt: booking.createdAt.toISOString(),
  };
};
