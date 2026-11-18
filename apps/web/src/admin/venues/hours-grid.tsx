"use client";

import type { PriceTier, ScheduleDay } from "@hagz/contracts";
import { useId } from "react";
import { useSize } from "./use-size";

// A ground's week as the staff app draws it (its "paint the week" grid, Figma E1 470:11), read only
// and in the admin's inks: a column per day and a cell per hour. Base hours light grey, peak dark,
// discount dashed diagonally on a paler grey; closed hours a faint fill with no outline, so the open
// ones are what reads. Each cell says its hour on hover.
//
// Unlike the app, which shows every hour for painting, it shows only the hours the ground uses
// (user, 2026-11-18): its day starts where its longest closed stretch ends, so "4 pm – 2 am" is one
// block of 10 rows, a late night carrying on down its evening's column. Fewer rows get taller cells.

const GAP = 4;
const RADIUS = 4;
const LABELS = 44;
// The cells' share of the modal's height, and the sizes a cell can take in it.
const HEIGHT = 300;
const CELL = { min: 11, max: 22 };

const FILL: Record<PriceTier, string> = {
  BASE: "#dfe2e6",
  PEAK: "#5e636b",
  DISCOUNT: "#eef0f2",
};
const CLOSED = "#f6f7f8";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const TIER_LABEL: Record<PriceTier, string> = { BASE: "Base", PEAK: "Peak", DISCOUNT: "Discount" };

// "4 pm", "12 am".
const hourLabel = (hour: number) => {
  const clock = hour % 24;
  return `${String(clock % 12 === 0 ? 12 : clock % 12)} ${clock < 12 ? "am" : "pm"}`;
};

const WEEK = 7 * 24;

// A ground's week as the grid shows it: the hour its days start at, how many rows they run, the tier
// of each cell (null is closed), and which columns have no open hours.
export function weekOf(schedule: ScheduleDay[]) {
  // Each hour of the week, Sunday 12 am (0) to Saturday 11 pm (167).
  const ring: (PriceTier | null)[] = Array.from({ length: WEEK }, () => null);
  for (const day of schedule)
    for (const { hour, tier } of day.hours) ring[day.dayOfWeek * 24 + hour] = tier;

  // The hours of the day open on any day; the longest run of the others, round the clock, is the
  // night every column skips.
  const used = Array.from({ length: 24 }, (_, hour) =>
    Array.from({ length: 7 }, (_, day) => ring[day * 24 + hour]).some((tier) => tier != null),
  );
  let start = 0;
  let rows = 24;
  if (!used.some(Boolean)) rows = 0;
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
    rows = 24 - best.length;
  }

  // Which hour of the week a cell is: a column's rows run on past its midnight.
  const at = (day: number, row: number) => (day * 24 + start + row) % WEEK;
  const tierOf = (day: number, row: number) => ring[at(day, row)] ?? null;
  const closedDays = Array.from({ length: 7 }, (_, day) => day).filter((day) =>
    Array.from({ length: rows }, (_, row) => tierOf(day, row)).every((tier) => tier === null),
  );
  return { start, rows, at, tierOf, closedDays };
}

// The discount's dashed lines at 45°, one pattern for a whole drawing (in its own coordinates), so
// the stripes run on from one cell into the next as they do in the app.
function DiscountPattern({ id }: { id: string }) {
  return (
    <pattern
      id={id}
      width={6}
      height={6}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={6}
        stroke="#9aa0a8"
        strokeWidth={1.4}
        strokeDasharray="2.5 2"
      />
    </pattern>
  );
}

export function HoursGrid({ schedule }: { schedule: ScheduleDay[] }) {
  const { ref, size } = useSize();
  const pattern = useId();
  const week = weekOf(schedule);
  const cell = Math.max(CELL.min, Math.min(CELL.max, Math.floor(HEIGHT / week.rows) - GAP));
  const row = cell + GAP;
  const column = size.width / 7;
  // Every hour when there's room for its label, otherwise every other one.
  const step = row >= 20 ? 1 : 2;

  if (week.rows === 0) {
    return <p className="text-body text-ink-3">No opening hours yet.</p>;
  }

  return (
    <div className="flex">
      <div className="relative shrink-0" style={{ width: LABELS, height: 22 + week.rows * row }}>
        {Array.from({ length: Math.ceil(week.rows / step) }, (_, i) => (
          <span
            key={i}
            className="absolute left-0 text-caption leading-none text-ink-3 tabular-nums"
            // Level with the middle of its cell.
            style={{ top: 22 + i * step * row + GAP / 2 + cell / 2 - 6 }}
          >
            {hourLabel(week.start + i * step)}
          </span>
        ))}
      </div>
      <div ref={ref} className="min-w-0 flex-1">
        <div className="flex h-[22px]">
          {DAYS.map((day, index) => (
            // A day with no open hours is quieter.
            <span
              key={day}
              className={`flex-1 text-center text-caption font-medium ${week.closedDays.includes(index) ? "text-ink-3" : "text-ink"}`}
            >
              {day}
            </span>
          ))}
        </div>
        {size.width > 0 ? (
          <svg
            role="img"
            aria-label="Opening hours by day"
            width={size.width}
            height={week.rows * row}
            className="block"
          >
            <defs>
              <DiscountPattern id={pattern} />
            </defs>
            {Array.from({ length: 7 }, (_, day) =>
              Array.from({ length: week.rows }, (_, r) => {
                const tier = week.tierOf(day, r);
                const hour = week.at(day, r);
                const x = day * column + GAP / 2;
                const y = r * row + GAP / 2;
                const w = column - GAP;
                // Named for the day the hour falls on, so a late night says it's the next morning.
                const label = `${DAY_NAMES[Math.floor(hour / 24)] ?? ""} ${hourLabel(hour)} – ${hourLabel(hour + 1)} · ${
                  tier ? TIER_LABEL[tier] : "Closed"
                }`;
                return (
                  <g key={`${String(day)}:${String(r)}`}>
                    <title>{label}</title>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={cell}
                      rx={RADIUS}
                      fill={tier ? FILL[tier] : CLOSED}
                    />
                    {tier === "DISCOUNT" ? (
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={cell}
                        rx={RADIUS}
                        fill={`url(#${pattern})`}
                        opacity={0.85}
                      />
                    ) : null}
                  </g>
                );
              }),
            )}
          </svg>
        ) : (
          <div style={{ height: week.rows * row }} />
        )}
      </div>
    </div>
  );
}

// A small piece of a cell, for the prices that key the grid.
export function TierSwatch({ tier }: { tier: PriceTier }) {
  const pattern = useId();
  return (
    <svg aria-hidden width={20} height={12} className="shrink-0">
      {tier === "DISCOUNT" ? (
        <defs>
          <DiscountPattern id={pattern} />
        </defs>
      ) : null}
      <rect width={20} height={12} rx={3.5} fill={FILL[tier]} />
      {tier === "DISCOUNT" ? (
        <rect width={20} height={12} rx={3.5} fill={`url(#${pattern})`} opacity={0.85} />
      ) : null}
    </svg>
  );
}
