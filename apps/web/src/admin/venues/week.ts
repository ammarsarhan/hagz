import type { PriceTier, ScheduleDay } from "@hagz/contracts";

// A ground's week as the admin shows it, from its schedule (calendar days, as the API stores them):
// every day the whole clock, 12 am to its last hour at 11 pm, whatever hours it uses (user,
// 2026-11-19), closed hours left as gaps. A late night past midnight shows on the next day's row.

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

// A ground's week as the admin shows it: how many hours a day runs (24, or none when nothing is
// open all week), the tier of each hour of each day (null is closed), and which days have none open.
export function weekOf(schedule: ScheduleDay[]) {
  const tiers = new Map<string, PriceTier>();
  for (const day of schedule)
    for (const { hour, tier } of day.hours)
      tiers.set(`${String(day.dayOfWeek)}:${String(hour)}`, tier);

  const tierOf = (day: number, hour: number) => tiers.get(`${String(day)}:${String(hour)}`) ?? null;
  const closedDays = Array.from({ length: 7 }, (_, day) => day).filter((day) =>
    Array.from({ length: 24 }, (_, hour) => tierOf(day, hour)).every((tier) => tier === null),
  );
  return { hours: tiers.size === 0 ? 0 : 24, tierOf, closedDays };
}
