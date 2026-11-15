import type { TFunction } from "i18next";
import type { components } from "@hagz/api";

// A ground's week, the way an owner thinks of it: each day opens once, at a whole hour, and may run
// past midnight ("Thursday, 4 pm – 2 am"), with at most one stretch of peak hours and one of
// discounted hours inside it. Hours are counted from that day's midnight, so 2 am the next morning
// is 26.
//
// The API stores calendar days instead (docs/onboarding.md): hours past midnight belong to the next
// day's row. These turn one into the other.
export type ScheduleDay = components["schemas"]["ScheduleDay"];
export type Tier = components["schemas"]["PriceTier"];

export interface Range {
  start: number;
  end: number; // exclusive; start < end <= start + 24
}

export interface DayHours {
  open: Range | null;
  peak: Range | null;
  discount: Range | null;
}

export type Week = DayHours[]; // 7, from Sunday

const WEEK = 7 * 24;
export const CLOSED: DayHours = { open: null, peak: null, discount: null };
export const length = (range: Range) => range.end - range.start;
const contains = (range: Range | null, hour: number) =>
  range !== null && hour >= range.start && hour < range.end;

// ---------- From the API ----------

// The tier of every hour of the week, from Sunday 12 am (0) to Saturday 11 pm (167).
const ringOf = (days: ScheduleDay[]) => {
  const ring: (Tier | null)[] = Array.from({ length: WEEK }, () => null);
  for (const day of days) {
    for (const { hour, tier } of day.hours) ring[day.dayOfWeek * 24 + hour] = tier;
  }
  return ring;
};

// Each stretch of open hours belongs to the day it starts on. A day with more than one stretch
// (which this app never writes) keeps its longest; a stretch longer than a day is cut into days.
export const weekFromApi = (days: ScheduleDay[]): Week => {
  const ring = ringOf(days);
  const week: Week = Array.from({ length: 7 }, () => ({ ...CLOSED }));
  if (ring.every((tier) => tier !== null)) {
    // Open round the clock.
    return week.map((_, day) => dayFromRing(ring, day * 24, 24));
  }
  // Start just after a closed hour, so no stretch is split by where the scan begins.
  const first = ring.findIndex((tier, i) => tier === null && ring[(i + 1) % WEEK] !== null);
  if (first === -1) return week;
  let i = 0;
  while (i < WEEK) {
    const at = (first + 1 + i) % WEEK;
    if (ring[at] === null) {
      i += 1;
      continue;
    }
    let run = 0;
    while (run < WEEK && ring[(at + run) % WEEK] !== null) run += 1;
    // Cut into pieces of at most a day, each on the day it starts.
    for (let offset = 0; offset < run; offset += 24) {
      const start = (at + offset) % WEEK;
      const hours = Math.min(24, run - offset);
      const day = Math.floor(start / 24);
      const current = week[day]?.open;
      if (!current || hours > length(current)) week[day] = dayFromRing(ring, start, hours);
    }
    i += run;
  }
  return week;
};

// One day's stretch, with its first peak and discount runs.
const dayFromRing = (ring: (Tier | null)[], absoluteStart: number, hours: number): DayHours => {
  const start = absoluteStart % 24;
  const tierAt = (offset: number) => ring[(absoluteStart + offset) % WEEK];
  const runOf = (tier: Tier): Range | null => {
    let from = -1;
    for (let offset = 0; offset <= hours; offset += 1) {
      const match = offset < hours && tierAt(offset) === tier;
      if (match && from === -1) from = offset;
      if (!match && from !== -1) return { start: start + from, end: start + offset };
    }
    return null;
  };
  return {
    open: { start, end: start + hours },
    peak: runOf("PEAK"),
    discount: runOf("DISCOUNT"),
  };
};

// ---------- The week as hours ----------

// Every hour of the week with its tier, or null when closed, from Sunday 12 am (0) to Saturday
// 11 pm (167): what the week grid paints. Unlike Week it takes any shape (two stretches in a day,
// peak hours twice), which the API takes too.
export type Ring = (Tier | null)[];

export const ringFromApi = (days: ScheduleDay[]): Ring => ringOf(days);

export const ringToApi = (ring: Ring): ScheduleDay[] => {
  const days: ScheduleDay[] = [];
  ring.forEach((tier, at) => {
    if (tier === null) return;
    const dayOfWeek = Math.floor(at / 24);
    let day = days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) {
      day = { dayOfWeek, hours: [] };
      days.push(day);
    }
    day.hours.push({ hour: at % 24, tier });
  });
  return days;
};

export const sameRing = (a: Ring, b: Ring) => a.every((tier, at) => tier === b[at]);

// The grid's days start at 6 am rather than midnight, so a late night sits under the evening it
// belongs to: row 0 is 6 am, row 23 is 5 am the next morning. Each of the week's hours is in
// exactly one cell.
export const GRID_START = 6;
export const GRID_ROWS = 24;
export const hourOfCell = (day: number, row: number) => (day * 24 + GRID_START + row) % WEEK;

// A rectangle of cells: days `fromDay`–`toDay`, rows `fromRow`–`toRow`, inclusive.
export interface CellBlock {
  fromDay: number;
  toDay: number;
  fromRow: number;
  toRow: number;
}

export const blockBetween = (
  a: { day: number; row: number },
  b: { day: number; row: number },
): CellBlock => ({
  fromDay: Math.min(a.day, b.day),
  toDay: Math.max(a.day, b.day),
  fromRow: Math.min(a.row, b.row),
  toRow: Math.max(a.row, b.row),
});

export const inBlock = (block: CellBlock, day: number, row: number) =>
  day >= block.fromDay && day <= block.toDay && row >= block.fromRow && row <= block.toRow;

export const blockHours = (block: CellBlock) =>
  (block.toDay - block.fromDay + 1) * (block.toRow - block.fromRow + 1);

export const paintBlock = (ring: Ring, block: CellBlock, tier: Tier | null): Ring => {
  const next = [...ring];
  for (let day = block.fromDay; day <= block.toDay; day += 1) {
    for (let row = block.fromRow; row <= block.toRow; row += 1) next[hourOfCell(day, row)] = tier;
  }
  return next;
};

// ---------- To the API ----------

export const tierAt = (day: DayHours, hour: number): Tier =>
  contains(day.peak, hour) ? "PEAK" : contains(day.discount, hour) ? "DISCOUNT" : "BASE";

export const weekToApi = (week: Week): ScheduleDay[] => {
  const byDay = new Map<number, Map<number, Tier>>();
  week.forEach((day, dayOfWeek) => {
    if (!day.open) return;
    for (let hour = day.open.start; hour < day.open.end; hour += 1) {
      const absolute = (dayOfWeek * 24 + hour) % WEEK;
      const calendarDay = Math.floor(absolute / 24);
      const hours = byDay.get(calendarDay) ?? new Map<number, Tier>();
      hours.set(absolute % 24, tierAt(day, hour));
      byDay.set(calendarDay, hours);
    }
  });
  return [...byDay].map(([dayOfWeek, hours]) => ({
    dayOfWeek,
    hours: [...hours].map(([hour, tier]) => ({ hour, tier })),
  }));
};

// ---------- Editing one day ----------

// How far a day can reach without running into its neighbours: from where yesterday's late night
// ends, to where tomorrow opens (plus its midnight).
export const limitsOf = (week: Week, dayOfWeek: number) => {
  const before = week[(dayOfWeek + 6) % 7]?.open;
  const after = week[(dayOfWeek + 1) % 7]?.open;
  return {
    min: before && before.end > 24 ? before.end - 24 : 0,
    max: after ? 24 + after.start : 48,
  };
};

// Keeps peak and discount inside the open hours, dropping one that no longer fits.
const within = (range: Range | null, open: Range | null): Range | null => {
  if (!range || !open) return null;
  const start = Math.max(range.start, open.start);
  const end = Math.min(range.end, open.end);
  return start < end ? { start, end } : null;
};

// What's left of `range` once `taken` is cut out of it: the longer side, or nothing.
const without = (range: Range | null, taken: Range | null): Range | null => {
  if (!range || !taken || range.end <= taken.start || taken.end <= range.start) return range;
  const before = { start: range.start, end: Math.max(range.start, taken.start) };
  const after = { start: Math.min(range.end, taken.end), end: range.end };
  const longer = length(before) >= length(after) ? before : after;
  return length(longer) > 0 ? longer : null;
};

export const withOpen = (day: DayHours, open: Range): DayHours => ({
  open,
  peak: within(day.peak, open),
  discount: within(day.discount, open),
});

export const withPeak = (day: DayHours, peak: Range | null): DayHours => ({
  ...day,
  peak,
  discount: without(day.discount, peak),
});

export const withDiscount = (day: DayHours, discount: Range | null): DayHours => ({
  ...day,
  discount,
  peak: without(day.peak, discount),
});

// A handle dragged to a clock hour (0–23). Returns the new range, or null when the move isn't
// allowed (shorter than an hour, past a neighbour, or out of the open hours).
export const moveOpen = (
  open: Range,
  edge: "start" | "end",
  clock: number,
  limits: { min: number; max: number },
): Range | null => {
  const span = (from: number, to: number) => {
    const hours = (((to - from) % 24) + 24) % 24;
    // Handles meeting: round the clock if it was nearly there, otherwise not allowed.
    return hours === 0 ? (length(open) >= 23 ? 24 : 0) : hours;
  };
  const next =
    edge === "start"
      ? { start: clock, end: clock + span(clock, open.end % 24) }
      : { start: open.start, end: open.start + span(open.start, clock) };
  if (length(next) < 1 || next.start < limits.min || next.end > limits.max) return null;
  return next;
};

export const moveInside = (
  range: Range,
  edge: "start" | "end",
  clock: number,
  open: Range,
): Range | null => {
  // The clock hour, as an hour of this day inside the open hours.
  const hour =
    edge === "start"
      ? clock >= open.start
        ? clock
        : clock + 24
      : clock > open.start
        ? clock
        : clock + 24;
  const next =
    edge === "start" ? { start: hour, end: range.end } : { start: range.start, end: hour };
  if (next.start < open.start || next.end > open.end || length(next) < 1) return null;
  return next;
};

// Where a new peak or discount stretch starts: the last three open hours for peak, the first two
// for discount.
export const defaultPeak = (open: Range): Range => ({
  start: Math.max(open.start, open.end - 3),
  end: open.end,
});
export const defaultDiscount = (open: Range): Range => ({
  start: open.start,
  end: Math.min(open.end, open.start + 2),
});

// ---------- Words ----------

// "4 pm", "12 am"; in Arabic "4 م". Western digits in both.
export const hourLabel = (t: TFunction, hour: number) => {
  const clock = ((hour % 24) + 24) % 24;
  const twelve = clock % 12 === 0 ? 12 : clock % 12;
  return t(clock < 12 ? "screens.setup.hours.am" : "screens.setup.hours.pm", { hour: twelve });
};

export const rangeLabel = (t: TFunction, range: Range) =>
  length(range) === 24
    ? t("screens.setup.hours.allDay")
    : `${hourLabel(t, range.start)} – ${hourLabel(t, range.end)}`;

// The normal hours: what's open but neither peak nor discount, as ranges.
export const normalRanges = (day: DayHours): Range[] => {
  if (!day.open) return [];
  const ranges: Range[] = [];
  let from: number | null = null;
  for (let hour = day.open.start; hour <= day.open.end; hour += 1) {
    const normal = hour < day.open.end && tierAt(day, hour) === "BASE";
    if (normal && from === null) from = hour;
    if (!normal && from !== null) {
      ranges.push({ start: from, end: hour });
      from = null;
    }
  }
  return ranges;
};

// A week in a few words, for the list of grounds: "Every day · 4 pm – 2 am", "5 days open", or null
// when nothing's set.
export const weekSummary = (t: TFunction, week: Week) => {
  const open = week.filter((day) => day.open);
  if (open.length === 0) return null;
  const first = open[0]?.open;
  const same =
    first !== undefined &&
    first !== null &&
    open.every((day) => day.open?.start === first.start && day.open.end === first.end);
  const days =
    open.length === 7
      ? t("screens.setup.hours.everyDay")
      : t("screens.setup.hours.daysOpen", { count: open.length });
  return same && first ? `${days} · ${rangeLabel(t, first)}` : days;
};

// A block in words: "Thu to Fri · 7 pm – 1 am", "Thursday · 7 pm – 1 am".
export const blockLabel = (t: TFunction, block: CellBlock) => {
  const days =
    block.fromDay === block.toDay
      ? dayName(t, block.fromDay)
      : t("screens.setup.hours.dayRange", {
          from: shortDayName(t, block.fromDay),
          to: shortDayName(t, block.toDay),
        });
  const hours = `${hourLabel(t, GRID_START + block.fromRow)} – ${hourLabel(t, GRID_START + block.toRow + 1)}`;
  return `${days} · ${hours}`;
};

// Day names, from Sunday (0).
type DayKey = "0" | "1" | "2" | "3" | "4" | "5" | "6";
const keyOf = (dayOfWeek: number) => String(dayOfWeek) as DayKey;
export const dayName = (t: TFunction, dayOfWeek: number) =>
  t(`screens.setup.hours.days.${keyOf(dayOfWeek)}`);
export const shortDayName = (t: TFunction, dayOfWeek: number) =>
  t(`screens.setup.hours.shortDays.${keyOf(dayOfWeek)}`);
export const dayLetter = (t: TFunction, dayOfWeek: number) =>
  t(`screens.setup.hours.letters.${keyOf(dayOfWeek)}`);
