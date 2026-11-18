import type { PriceTier, ScheduleDay } from "@hagz/contracts";

// A ground's week as the admin shows it, from its schedule (calendar days, as the API stores them):
// only the hours it uses, its day starting where its longest closed stretch ends (user, 2026-11-18),
// so "4 pm – 2 am" is one run, a late night carrying on in its evening's day.

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// "4 pm", "12 am".
export const hourLabel = (hour: number) => {
  const clock = ((hour % 24) + 24) % 24;
  return `${String(clock % 12 === 0 ? 12 : clock % 12)} ${clock < 12 ? "am" : "pm"}`;
};

const WEEK = 7 * 24;

// A ground's week as the admin shows it: the hour its days start at, how many hours they run, the
// tier of each of a day's hours (null is closed), and which days have none open.
export function weekOf(schedule: ScheduleDay[]) {
  // Each hour of the week, Sunday 12 am (0) to Saturday 11 pm (167).
  const ring: (PriceTier | null)[] = Array.from({ length: WEEK }, () => null);
  for (const day of schedule)
    for (const { hour, tier } of day.hours) ring[day.dayOfWeek * 24 + hour] = tier;

  // The hours of the day open on any day; the longest run of the others, round the clock, is the
  // night every day skips.
  const used = Array.from({ length: 24 }, (_, hour) =>
    Array.from({ length: 7 }, (_, day) => ring[day * 24 + hour]).some((tier) => tier != null),
  );
  let start = 0;
  let hours = 24;
  if (!used.some(Boolean)) hours = 0;
  else if (!used.every(Boolean)) {
    let best = { from: 0, length: 0 };
    for (let from = 0; from < 24; from += 1) {
      // Only runs that start just after an open hour, so each is counted whole.
      if (used[from] || !used[(from + 23) % 24]) continue;
      let length = 0;
      while (!used[(from + length) % 24]) length += 1;
      if (length > best.length) best = { from, length };
    }
    start = (best.from + best.length) % 24;
    hours = 24 - best.length;
  }

  // Which hour of the week a day's nth hour is: a day runs on past its midnight.
  const at = (day: number, offset: number) => (day * 24 + start + offset) % WEEK;
  const tierOf = (day: number, offset: number) => ring[at(day, offset)] ?? null;
  const closedDays = Array.from({ length: 7 }, (_, day) => day).filter((day) =>
    Array.from({ length: hours }, (_, offset) => tierOf(day, offset)).every(
      (tier) => tier === null,
    ),
  );
  return { start, hours, at, tierOf, closedDays };
}
