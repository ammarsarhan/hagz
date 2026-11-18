import type { PriceTier, ScheduleDay } from "@hagz/contracts";

// Which slots a ground should have (PR 2.6): the one definition, used by every edit's regeneration,
// the nightly roll-forward and the drift audit. Pure: no database, no clock.
//
// A schedule is a week of local hours (0–23) on calendar days, an hour past midnight in the next
// day's row. Each scheduled hour on each local date in the window becomes a 60-minute slot starting
// at that local time in the venue's IANA timezone, never a fixed offset: Egypt has DST again, so
// a day can have 23 or 25 hours. A local hour the clocks skip has no slot; one they repeat has one,
// at its first occurrence, so no two slots share a start and none overlap. Each slot carries its
// tier and that tier's price; an hour whose tier has no price (the API refuses to save one, so only
// if data drifted) has no slot rather than a wrong price.

export const SLOT_MINUTES = 60;
// How far ahead slots exist, and so how far ahead players can book. A CHECK on GroundSlot and
// GroundSettings.generatedUntil backs it up.
export const HORIZON_DAYS = 90;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface TierPrices {
  basePrice: number;
  peakPrice: number | null;
  discountPrice: number | null;
}

export interface DesiredSlot {
  startsAt: Date;
  endsAt: Date;
  tier: PriceTier;
  price: number;
}

const priceOf = (tier: PriceTier, prices: TierPrices) =>
  tier === "BASE" ? prices.basePrice : tier === "PEAK" ? prices.peakPrice : prices.discountPrice;

// The local wall time of an instant in a timezone, to the hour.
const formats = new Map<string, Intl.DateTimeFormat>();
const wallTime = (instant: number, timezone: string) => {
  let format = formats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    formats.set(timezone, format);
  }
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(new Date(instant))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
  };
};

// How far a timezone's clocks are ahead of UTC at an instant, in ms.
const offsetAt = (instant: number, timezone: string) => {
  const local = wallTime(instant, timezone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  return asUtc - Math.floor(instant / 60_000) * 60_000;
};

// The first instant whose local time in the timezone is this date and hour, or null when the clocks
// skip it. The offset either side of the date covers both a jump forward and a jump back.
export const instantOf = (
  date: { year: number; month: number; day: number },
  hour: number,
  timezone: string,
): number | null => {
  const naive = Date.UTC(date.year, date.month - 1, date.day, hour);
  const candidates = [
    naive - offsetAt(naive - 12 * HOUR_MS, timezone),
    naive - offsetAt(naive + 12 * HOUR_MS, timezone),
  ].filter((instant) => {
    const local = wallTime(instant, timezone);
    return (
      local.year === date.year &&
      local.month === date.month &&
      local.day === date.day &&
      local.hour === hour &&
      local.minute === 0
    );
  });
  return candidates.length === 0 ? null : Math.min(...candidates);
};

export const desiredSlots = ({
  schedule,
  prices,
  timezone,
  from,
  to,
}: {
  schedule: ScheduleDay[];
  prices: TierPrices;
  timezone: string;
  // Slots starting in [from, to).
  from: Date;
  to: Date;
}): DesiredSlot[] => {
  const byDay = new Map(schedule.map((day) => [day.dayOfWeek, day.hours]));
  const slots: DesiredSlot[] = [];
  const seen = new Set<number>();
  // Every local date the window touches, from the day before its start (a timezone ahead of UTC is
  // already on the next date) to the day after its end.
  const first = wallTime(from.getTime() - DAY_MS, timezone);
  let cursor = Date.UTC(first.year, first.month - 1, first.day);
  const last = to.getTime() + DAY_MS;
  for (; cursor <= last; cursor += DAY_MS) {
    const day = new Date(cursor);
    const date = {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
    };
    for (const { hour, tier } of byDay.get(day.getUTCDay()) ?? []) {
      const start = instantOf(date, hour, timezone);
      if (start === null || start < from.getTime() || start >= to.getTime()) continue;
      if (seen.has(start)) continue;
      const price = priceOf(tier, prices);
      if (price === null) continue;
      seen.add(start);
      slots.push({
        startsAt: new Date(start),
        endsAt: new Date(start + SLOT_MINUTES * 60_000),
        tier,
        price,
      });
    }
  }
  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
};

// The window slots are kept for: from now to the horizon, the end a minute short of it and on a
// whole hour, so a slot never starts past the CHECK's `now() + 90 days` however the clocks differ.
export const generationWindow = (now: Date) => {
  const end = now.getTime() + HORIZON_DAYS * DAY_MS - 60_000;
  return { from: now, to: new Date(Math.floor(end / HOUR_MS) * HOUR_MS) };
};
