import type { AmenityPricing, BookingStatus, PriceTier } from "@hagz/contracts";
import { AppError } from "@/platform/errors/app-error";
import { vatInside, type PricedSlot } from "./charges";

// Moving a booking (PR 4.8, docs/rescheduling.md). Pure: the use cases lock the rows and pass them
// in.

// Statuses a booking can be moved in, before it starts. A regular's UNCONFIRMED reservation moves
// too.
export const MOVABLE: readonly BookingStatus[] = ["PENDING", "HELD", "UNCONFIRMED", "CONFIRMED"];

// How long a player has to answer a move: this many hours after it, or until kick-off if sooner.
export const MOVE_RESPONSE_HOURS = 24;

export const notMovable = (status: BookingStatus) =>
  new AppError({
    code: "BOOKING_NOT_MOVABLE",
    status: 409,
    detail: "Only bookings still to be played can be moved, before they start.",
    extensions: { bookingStatus: status },
  });

export const checkMovable = (booking: { status: BookingStatus; startsAt: Date }, now: Date) => {
  if (!MOVABLE.includes(booking.status) || booking.startsAt <= now) {
    throw notMovable(booking.status);
  }
};

export const respondBy = (movedAt: Date, startsAt: Date): Date =>
  new Date(Math.min(movedAt.getTime() + MOVE_RESPONSE_HOURS * 60 * 60_000, startsAt.getTime()));

export interface StoredCharge {
  type: "SLOT" | "AMENITY" | "DISCOUNT" | "REWARD";
  startsAt: Date | null;
  tier: PriceTier | null;
  optionId: string | null;
  discountId: string | null;
  pricing: AmenityPricing | null;
  amount: number;
  taxRate: number;
  taxAmount: number;
}

// The moved booking's charges: one line per new slot at the price it carries now, at the original's
// VAT rate (its terms); per-hour amenities follow the new number of hours at the price paid per
// hour; everything else (flat amenities, a discount, a reward) as it was.
export const chargesAfterMove = (
  charges: readonly StoredCharge[],
  slots: readonly PricedSlot[],
): { lines: StoredCharge[]; total: number; tax: number } => {
  const oldHours = charges.filter((charge) => charge.type === "SLOT");
  const taxRate = oldHours[0]?.taxRate ?? 0;
  const lines: StoredCharge[] = [
    ...slots.map((slot) => ({
      type: "SLOT" as const,
      startsAt: slot.startsAt,
      tier: slot.tier,
      optionId: null,
      discountId: null,
      pricing: null,
      amount: slot.price,
      taxRate,
      taxAmount: vatInside(slot.price, taxRate),
    })),
    ...charges
      .filter((charge) => charge.type !== "SLOT")
      .map((charge) => {
        if (charge.type !== "AMENITY" || charge.pricing !== "PER_HOUR" || oldHours.length === 0) {
          return charge;
        }
        const amount = (charge.amount / oldHours.length) * slots.length;
        return { ...charge, amount, taxAmount: vatInside(amount, charge.taxRate) };
      }),
  ];
  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    tax: lines.reduce((sum, line) => sum + line.taxAmount, 0),
  };
};

// A deposit keeps the share of the total it was, rounded up, at least 1 and never over the total.
export const depositAfterMove = (
  deposit: number | null,
  oldTotal: number,
  newTotal: number,
): number | null => {
  if (deposit === null) return null;
  if (oldTotal === 0) return Math.min(deposit, newTotal);
  return Math.min(newTotal, Math.max(1, Math.ceil((newTotal * deposit) / oldTotal)));
};
