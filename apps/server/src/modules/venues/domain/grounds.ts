import {
  sizeFitsSport,
  type CreateGround,
  type PriceTier,
  type ScheduleDay,
  type UpdateGround,
} from "@hagz/contracts";
import { AppError } from "@/platform/errors/app-error";

// A ground's fields as stored, for checking an update as a whole.
export type GroundFields = Omit<CreateGround, "name">;

export const invalidGround = (field: string, detail: string) =>
  new AppError({ code: "INVALID_GROUND", status: 422, detail, extensions: { field } });

// Applies a partial change and checks what results: a size the sport comes in, a shortest booking
// no longer than the longest, and no price removed while the week still uses its tier.
export const mergeGround = (
  current: GroundFields,
  change: Omit<UpdateGround, "name" | "status">,
  tiersInUse: Set<PriceTier>,
): GroundFields => {
  const next = { ...current, ...stripUndefined(change) };
  if (!sizeFitsSport(next.sport, next.size)) {
    throw invalidGround("size", "That size doesn't exist for that sport.");
  }
  if (next.minimumSlots > next.maximumSlots) {
    throw invalidGround("minimumSlots", "The shortest booking can't be longer than the longest.");
  }
  if (next.peakPrice === null && tiersInUse.has("PEAK")) {
    throw invalidGround("peakPrice", "Some hours are marked peak. Unmark them first.");
  }
  if (next.discountPrice === null && tiersInUse.has("DISCOUNT")) {
    throw invalidGround("discountPrice", "Some hours are discounted. Unmark them first.");
  }
  return next;
};

const stripUndefined = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;

export const scheduleNeedsPrice = (tier: PriceTier) =>
  new AppError({
    code: "SCHEDULE_TIER_WITHOUT_PRICE",
    status: 422,
    detail: `Set a ${tier === "PEAK" ? "peak" : "discount"} price before marking hours with it.`,
    extensions: { tier },
  });

// Peak and discount hours need the ground to have that price.
export const checkScheduleAgainstPrices = (
  days: ScheduleDay[],
  prices: { peakPrice: number | null; discountPrice: number | null },
) => {
  const used = tiersIn(days);
  if (used.has("PEAK") && prices.peakPrice === null) throw scheduleNeedsPrice("PEAK");
  if (used.has("DISCOUNT") && prices.discountPrice === null) throw scheduleNeedsPrice("DISCOUNT");
};

export const tiersIn = (days: ScheduleDay[]) =>
  new Set(days.flatMap((day) => day.hours.map((h) => h.tier)));

// GroundSchedule.hours is stored as { "18": "PEAK" }; the API speaks [{ hour: 18, tier: "PEAK" }].
export const toStoredHours = (day: ScheduleDay) =>
  Object.fromEntries(
    [...day.hours].sort((a, b) => a.hour - b.hour).map((h) => [String(h.hour), h.tier]),
  );

export const fromStoredHours = (dayOfWeek: number, stored: unknown): ScheduleDay => ({
  dayOfWeek,
  hours: Object.entries((stored ?? {}) as Record<string, PriceTier>)
    .map(([hour, tier]) => ({ hour: Number(hour), tier }))
    .sort((a, b) => a.hour - b.hour),
});
