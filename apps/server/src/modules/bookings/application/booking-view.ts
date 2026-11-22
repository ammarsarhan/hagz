import type { Booking, BookingCharge, CancellationTier } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { nameIn } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import type { ChargeLine } from "../domain/charges";

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
      total: true,
      depositAmount: true,
      paymentMode: true,
      cancellationPolicy: true,
      cancellationTiers: true,
      note: true,
      createdAt: true,
      venue: {
        select: { id: true, slug: true, ...names, marketplace: { select: { currency: true } } },
      },
      ground: { select: { id: true, sport: true, size: true, ...names } },
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
    charges: booking.charges.map((charge) =>
      presentCharge(charge, (id) => optionNames.get(id) ?? null),
    ),
    cancellation: {
      policy: booking.cancellationPolicy,
      tiers: booking.cancellationTiers as CancellationTier[],
    },
    note: booking.note,
    createdAt: booking.createdAt.toISOString(),
  };
};
