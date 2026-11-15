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
