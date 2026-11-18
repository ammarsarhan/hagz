"use client";

import type { PriceTier, ScheduleDay } from "@hagz/contracts";
import { useId } from "react";
import { useSize } from "./use-size";

// A ground's week as the staff app draws it (its "paint the week" grid, Figma E1 470:11), read only
// and in the admin's inks: a column per day and a cell per hour, 12 am down to the next midnight.
// Base hours light grey, peak dark, discount dashed diagonally on a paler grey, closed white with a
// hairline. Shorter cells than the app's, so the whole week fits a modal; each says its hour on
// hover.

const CELL = 13;
const GAP = 3;
const ROW = CELL + GAP;
const RADIUS = 3.5;
const LABELS = 44;

const FILL: Record<PriceTier, string> = {
  BASE: "#dfe2e6",
  PEAK: "#5e636b",
  DISCOUNT: "#eef0f2",
};
const CLOSED_LINE = "#e3e5e9";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIER_LABEL: Record<PriceTier, string> = { BASE: "Base", PEAK: "Peak", DISCOUNT: "Discount" };

// "4 pm", "12 am".
const hourLabel = (hour: number) => {
  const clock = hour % 24;
  return `${String(clock % 12 === 0 ? 12 : clock % 12)} ${clock < 12 ? "am" : "pm"}`;
};

// The tier of each hour of the week, Sunday 12 am (0) to Saturday 11 pm (167); null is closed.
const ringOf = (days: ScheduleDay[]) => {
  const ring: (PriceTier | null)[] = Array.from({ length: 7 * 24 }, () => null);
  for (const day of days)
    for (const { hour, tier } of day.hours) ring[day.dayOfWeek * 24 + hour] = tier;
  return ring;
};

// The discount's dashed lines at 45°, one pattern for the whole grid (in its own coordinates), so
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
  const ring = ringOf(schedule);
  const column = size.width / 7;
  const openDays = new Set(schedule.filter((day) => day.hours.length > 0).map((d) => d.dayOfWeek));

  return (
    <div>
      <div className="flex">
        {/* Every other hour down the side, level with the top of its cell. */}
        <div className="relative shrink-0" style={{ width: LABELS, height: 22 + 24 * ROW }}>
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="absolute left-0 text-caption leading-none text-ink-3 tabular-nums"
              style={{ top: 22 + i * 2 * ROW + GAP / 2 }}
            >
              {hourLabel(i * 2)}
            </span>
          ))}
        </div>
        <div ref={ref} className="min-w-0 flex-1">
          <div className="flex h-[22px]">
            {DAYS.map((day, index) => (
              // A day with no open hours is quieter.
              <span
                key={day}
                className={`flex-1 text-center text-caption font-medium ${openDays.has(index) ? "text-ink" : "text-ink-3"}`}
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
              height={24 * ROW}
              className="block"
            >
              <defs>
                <DiscountPattern id={pattern} />
              </defs>
              {Array.from({ length: 7 }, (_, day) =>
                Array.from({ length: 24 }, (_, hour) => {
                  const tier = ring[day * 24 + hour] ?? null;
                  const x = day * column + GAP / 2;
                  const y = hour * ROW + GAP / 2;
                  const w = column - GAP;
                  const label = `${DAY_NAMES[day] ?? ""} ${hourLabel(hour)} – ${hourLabel(hour + 1)} · ${
                    tier ? TIER_LABEL[tier] : "Closed"
                  }`;
                  return (
                    <g key={`${String(day)}:${String(hour)}`}>
                      <title>{label}</title>
                      {tier === null ? (
                        <rect
                          x={x + 0.5}
                          y={y + 0.5}
                          width={w - 1}
                          height={CELL - 1}
                          rx={RADIUS}
                          fill="#ffffff"
                          stroke={CLOSED_LINE}
                        />
                      ) : (
                        <rect x={x} y={y} width={w} height={CELL} rx={RADIUS} fill={FILL[tier]} />
                      )}
                      {tier === "DISCOUNT" ? (
                        <rect
                          x={x}
                          y={y}
                          width={w}
                          height={CELL}
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
            <div style={{ height: 24 * ROW }} />
          )}
        </div>
      </div>
      <GridKey />
    </div>
  );
}

// The key under the grid, as in the app: what each fill means.
function GridKey() {
  const pattern = useId();
  const tiers: { tier: PriceTier | null; label: string }[] = [
    { tier: "BASE", label: "Base" },
    { tier: "PEAK", label: "Peak" },
    { tier: "DISCOUNT", label: "Discount" },
    { tier: null, label: "Closed" },
  ];
  return (
    <ul className="mt-4 flex flex-wrap gap-x-[18px] gap-y-2" style={{ paddingLeft: LABELS }}>
      {tiers.map(({ tier, label }) => (
        <li key={label} className="flex items-center gap-2 text-caption text-ink-2">
          <svg aria-hidden width={22} height={14}>
            {tier === "DISCOUNT" ? (
              <defs>
                <DiscountPattern id={pattern} />
              </defs>
            ) : null}
            {tier === null ? (
              <rect
                x={0.5}
                y={0.5}
                width={21}
                height={13}
                rx={4}
                fill="#ffffff"
                stroke={CLOSED_LINE}
              />
            ) : (
              <rect width={22} height={14} rx={4} fill={FILL[tier]} />
            )}
            {tier === "DISCOUNT" ? (
              <rect width={22} height={14} rx={4} fill={`url(#${pattern})`} opacity={0.85} />
            ) : null}
          </svg>
          {label}
        </li>
      ))}
    </ul>
  );
}
