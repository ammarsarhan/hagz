import type { AmenityPricing, PriceTier } from "@hagz/contracts";

// A booking's price at the moment it's made (BookingCharge): one line per hour and per priced
// amenity, each VAT-inclusive with the VAT inside it recorded. Integer minor units throughout.

export interface PricedSlot {
  startsAt: Date;
  tier: PriceTier;
  price: number;
}

export interface PricedAmenity {
  optionId: string;
  price: number;
  pricing: AmenityPricing;
}

export interface ChargeLine {
  type: "SLOT" | "AMENITY" | "ADJUSTMENT";
  startsAt: Date | null;
  tier: PriceTier | null;
  optionId: string | null;
  pricing: AmenityPricing | null;
  amount: number;
  taxRate: number;
  taxAmount: number;
}

// The VAT inside a VAT-inclusive amount, at a rate in basis points (1400 = 14%): amount × r / (1 + r),
// rounded half up to the minor unit. 0 at a 0% rate.
export const vatInside = (amount: number, taxRate: number): number =>
  taxRate === 0 ? 0 : Math.round((amount * taxRate) / (10_000 + taxRate));

// Charges for the slots (one line per slot, at the price it carries) and the chosen amenities (per
// hour amenities multiplied by the number of slots). `taxRate` is the marketplace's when the venue
// has a tax number, else 0.
export const priceBooking = (
  slots: readonly PricedSlot[],
  amenities: readonly PricedAmenity[],
  taxRate: number,
): { lines: ChargeLine[]; total: number; tax: number } => {
  const line = (
    fields: Omit<ChargeLine, "taxRate" | "taxAmount" | "amount">,
    amount: number,
  ): ChargeLine => ({ ...fields, amount, taxRate, taxAmount: vatInside(amount, taxRate) });

  const lines = [
    ...slots.map((slot) =>
      line(
        { type: "SLOT", startsAt: slot.startsAt, tier: slot.tier, optionId: null, pricing: null },
        slot.price,
      ),
    ),
    ...amenities.map((amenity) =>
      line(
        {
          type: "AMENITY",
          startsAt: null,
          tier: null,
          optionId: amenity.optionId,
          pricing: amenity.pricing,
        },
        amenity.pricing === "PER_HOUR" ? amenity.price * slots.length : amenity.price,
      ),
    ),
  ];
  return {
    lines,
    total: lines.reduce((sum, charge) => sum + charge.amount, 0),
    tax: lines.reduce((sum, charge) => sum + charge.taxAmount, 0),
  };
};

// The share paid online for a DEPOSIT booking, rounded up so a small deposit is never 0, and never
// more than the total.
export const depositFor = (total: number, depositPercent: number): number =>
  Math.min(total, Math.max(1, Math.ceil((total * depositPercent) / 100)));

// A staff booking at the venue's own total (PR 4.3): one ADJUSTMENT line for the difference from the
// priced lines, either sign, at the same VAT rate. None when the total is already the price.
export const adjustedTo = (
  price: { lines: ChargeLine[]; total: number; tax: number },
  total: number,
  taxRate: number,
): { lines: ChargeLine[]; total: number; tax: number } => {
  const difference = total - price.total;
  if (difference === 0) return price;
  const adjustment: ChargeLine = {
    type: "ADJUSTMENT",
    startsAt: null,
    tier: null,
    optionId: null,
    pricing: null,
    amount: difference,
    taxRate,
    taxAmount: vatInside(difference, taxRate),
  };
  return {
    lines: [...price.lines, adjustment],
    total,
    tax: price.tax + adjustment.taxAmount,
  };
};
