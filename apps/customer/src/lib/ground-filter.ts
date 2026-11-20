import i18n from "@/i18next/i18next";
import { currencyName } from "./money";
import {
  dayText,
  settingName,
  sportName,
  surfaceName,
  type GroundSize,
  type Setting,
  type Sport,
  type Surface,
  type When,
} from "./search";
import { timeRange, type FreeSlot, type PublicGround } from "./venue";

// What a search asked of a venue's grounds, carried to the venue page in its link (user,
// 2026-11-20): the day, the start and how long, the sport and size, the surfaces and settings, and
// the price per hour. The venue page greys out the grounds that don't match, the way the search
// itself judges them (venue-search.ts on the server): a ground matches when it's of the sport, size,
// surface and setting asked for, and has a free run of the hours asked for on the day (from exactly
// the start, if there is one) priced within the range.

export interface GroundFilter {
  date?: string; // YYYY-MM-DD at the venue; none: today.
  start?: string; // HH:mm; none: any time that day.
  hours: number;
  sport?: string;
  size?: string;
  surfaces: string[];
  settings: string[];
  priceMin?: number; // Per hour, minor units.
  priceMax?: number;
}

type Params = Record<string, string | undefined>;

// The search's choices as the venue page's query parameters.
export const groundParams = (filter: GroundFilter): Record<string, string> => {
  const params: Record<string, string> = { hours: String(filter.hours) };
  if (filter.date) params.date = filter.date;
  if (filter.start) params.start = filter.start;
  if (filter.sport) params.sport = filter.sport;
  if (filter.size) params.size = filter.size;
  if (filter.surfaces.length > 0) params.surface = filter.surfaces.join(",");
  if (filter.settings.length > 0) params.setting = filter.settings.join(",");
  if (filter.priceMin !== undefined) params.priceMin = String(filter.priceMin);
  if (filter.priceMax !== undefined) params.priceMax = String(filter.priceMax);
  return params;
};

const number = (value: string | undefined) => {
  const parsed = value === undefined ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// Back from the venue page's parameters; null when it was opened without a search (a shared link).
export const groundFilterOf = (params: Params): GroundFilter | null => {
  const hours = number(params.hours);
  if (hours === undefined) return null;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;
  const start = params.start && /^\d{2}:\d{2}$/.test(params.start) ? params.start : undefined;
  return {
    date,
    start,
    hours: Math.min(Math.max(Math.round(hours), 1), 24),
    sport: params.sport || undefined,
    size: params.size || undefined,
    surfaces: params.surface ? params.surface.split(",") : [],
    settings: params.setting ? params.setting.split(",") : [],
    priceMin: number(params.priceMin),
    priceMax: number(params.priceMax),
  };
};

// The search's when as the filter's day, start and length.
export const whenFilter = (when: When) => ({
  ...(when.date ? { date: when.date } : {}),
  ...(when.start ? { start: when.start } : {}),
  hours: when.hours,
});

// A time's local date (YYYY-MM-DD) and clock (HH:mm) at the venue.
export const localDateOf = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(iso));
export const localTimeOf = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

// What a ground is: its sport, size, surface and setting against the filter's.
const fits = (ground: PublicGround, filter: GroundFilter) =>
  (!filter.sport || ground.sport === filter.sport) &&
  (!filter.size || ground.size === filter.size) &&
  (filter.surfaces.length === 0 || filter.surfaces.includes(ground.surface)) &&
  (filter.settings.length === 0 || filter.settings.includes(ground.environment));

// The free runs of `hours` on a ground on `date` (from exactly `start`, if asked), as their first
// slots and what the whole run costs.
export const runsOf = (
  ground: PublicGround,
  slots: FreeSlot[],
  filter: GroundFilter,
  date: string,
  timezone: string,
) => {
  const own = slots
    .filter((slot) => slot.groundId === ground.id)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const length = filter.hours * 3_600_000;
  return own.flatMap((first) => {
    if (localDateOf(first.startsAt, timezone) !== date) return [];
    if (filter.start && localTimeOf(first.startsAt, timezone) !== filter.start) return [];
    const from = Date.parse(first.startsAt);
    const run = own.filter(
      (slot) => Date.parse(slot.startsAt) >= from && Date.parse(slot.endsAt) <= from + length,
    );
    const covered = run.reduce(
      (sum, slot) => sum + Date.parse(slot.endsAt) - Date.parse(slot.startsAt),
      0,
    );
    if (covered !== length) return [];
    const price = run.reduce((sum, slot) => sum + slot.price, 0);
    if (filter.priceMin !== undefined && price < filter.priceMin * filter.hours) return [];
    if (filter.priceMax !== undefined && price > filter.priceMax * filter.hours) return [];
    return [{ first, run, price }];
  });
};

// The grounds that match: of the kind asked for, with a free run that fits.
export const matchingGrounds = (
  grounds: PublicGround[],
  slots: FreeSlot[],
  filter: GroundFilter,
  date: string,
  timezone: string,
) =>
  new Set(
    grounds
      .filter(
        (ground) =>
          ground.status === "ACTIVE" &&
          fits(ground, filter) &&
          runsOf(ground, slots, filter, date, timezone).length > 0,
      )
      .map((ground) => ground.id),
  );

// What the grounds were matched against, for under "Grounds": "Today, 9 – 11 pm · 5-a-side
// football · Under 400 EGP/hr". The day comes from `date` (the day the venue's free times were read
// for), the hours from the start and length.
export const describeFilter = (
  filter: GroundFilter,
  date: string,
  timezone: string,
  currency: string,
) => {
  const day = dayText(date, timezone);
  const parts: string[] = [];
  if (filter.start) {
    const [h = 0, m = 0] = filter.start.split(":").map(Number);
    const from = Date.UTC(2000, 0, 1, h, m);
    const iso = (at: number) => new Date(at).toISOString();
    parts.push(
      i18n.t("screens.venue.filter.at", {
        day,
        range: timeRange(iso(from), iso(from + filter.hours * 3_600_000), "UTC"),
      }),
    );
  } else {
    parts.push(
      filter.hours > 1
        ? i18n.t("screens.venue.filter.anyTimeFor", {
            day,
            hours: i18n.t("formats.hours", { count: filter.hours }),
          })
        : i18n.t("screens.venue.filter.anyTime", { day }),
    );
  }
  // A size is football's ("5-a-side football"); otherwise the sport alone.
  const size = filter.size as GroundSize | undefined;
  if (size && size !== "STANDARD") parts.push(i18n.t(`formats.footballSizes.${size}`));
  else if (filter.sport) parts.push(sportName(filter.sport as Sport));
  if (filter.surfaces.length > 0) {
    parts.push(filter.surfaces.map((each) => surfaceName(each as Surface)).join("/"));
  }
  if (filter.settings.length > 0) {
    parts.push(filter.settings.map((each) => settingName(each as Setting)).join("/"));
  }
  const amount = (minor: number) =>
    i18n.t("formats.price", {
      amount: String(Math.round(minor / 100)),
      currency: currencyName(currency),
    });
  if (filter.priceMin !== undefined && filter.priceMax !== undefined) {
    parts.push(
      i18n.t("screens.venue.filter.between", {
        from: Math.round(filter.priceMin / 100),
        to: amount(filter.priceMax),
      }),
    );
  } else if (filter.priceMax !== undefined) {
    parts.push(i18n.t("screens.venue.filter.under", { price: amount(filter.priceMax) }));
  } else if (filter.priceMin !== undefined) {
    parts.push(i18n.t("screens.venue.filter.from", { price: amount(filter.priceMin) }));
  }
  return parts.join(" · ");
};
