"use client";

// The admin home's charts, drawn with Recharts in Stripe's style (the user's reference): a line with
// the peak labelled top left and 0 bottom left, and an availability strip of half-hour blocks. Both
// answer hover and keyboard focus with a tooltip.
//
// Recharts writes colors as SVG attributes, where CSS variables don't resolve, so marks stroke and
// fill with currentColor under a text-* class, or take a fill-*/stroke-* class on the element itself.

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart as Lines,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const time = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false });

export interface Point {
  at: number;
  value: number | null;
}

// Minute samples are averaged into at most this many points: 15 minutes each over a full day, smooth
// like Stripe's charts instead of a jagged block. A point is never shorter than a minute, so a short
// history draws one point a minute instead of scattering into dots. A point with no samples leaves
// a gap, bridged in grey (see `bridges`).
const MAX_POINTS = 96;

const smooth = (points: Point[], from: number, to: number) => {
  const span = Math.max(1, to - from);
  const count = Math.max(1, Math.min(MAX_POINTS, Math.round(span / 60_000) + 1));
  const sums = Array.from({ length: count }, () => ({ total: 0, count: 0 }));
  for (const point of points) {
    if (point.value === null) continue;
    const i = Math.min(count - 1, Math.floor(((point.at - from) / span) * count));
    const bucket = sums[i];
    if (!bucket) continue;
    bucket.total += point.value;
    bucket.count += 1;
  }
  return sums.map((bucket, i) => ({
    at: count === 1 ? to : from + (i / (count - 1)) * span,
    value: bucket.count ? bucket.total / bucket.count : null,
  }));
};

// The gaps inside the line, each bridged by its own grey line from the last point before it to the
// first after it, so the chart never falls apart into pieces while a gap still reads as no data.
// Each bridge has its own key (gap0, gap1, …) with values only at its two ends: one key for all of
// them would also join the end of one gap to the start of the next, across the black line. Gaps at
// the start or the end have nothing on one side and stay empty.
const bridges = (line: { at: number; value: number | null }[]) => {
  const rows: Record<string, number | null>[] = line.map((point) => ({ ...point }));
  const keys: string[] = [];
  let before: number | undefined;
  line.forEach((point, i) => {
    if (point.value === null) return;
    if (before !== undefined && i - before > 1) {
      const key = `gap${keys.length}`;
      keys.push(key);
      rows[before]![key] = line[before]!.value;
      rows[i]![key] = point.value;
    }
    before = i;
  });
  return { rows, keys };
};

// The tooltip card: the value leads, what it's about follows in grey.
function Readout({ value, note }: { value: ReactNode; note: ReactNode }) {
  return (
    <div className="rounded-[0.375rem] border border-border bg-white px-2.5 py-1.5 shadow-sm">
      <p className="text-label font-semibold text-ink">{value}</p>
      <p className="text-[0.6875rem] text-ink-2">{note}</p>
    </div>
  );
}

// An axis label pinned to the start or end of its axis, so the outer labels sit inside the chart
// instead of centring on its edge and clipping.
const edgeTick =
  (format: (value: number) => string, anchor: (index: number) => "start" | "end" | "middle") =>
  ({
    x,
    y,
    payload,
    index,
  }: {
    x: number | string;
    y: number | string;
    payload: { value: number };
    index: number;
  }) => (
    <text
      x={x}
      y={y}
      dy="0.35em"
      textAnchor={anchor(index)}
      className="fill-ink-2 text-[0.6875rem]"
    >
      {format(payload.value)}
    </text>
  );

// One line through the points, in ink where there were samples and grey across the gaps where there
// weren't. The peak in the label is the true highest minute, not the averaged one.
export function LineChart({ points, unit }: { points: Point[]; unit: string }) {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const peak = Math.max(1, ...values);
  const from = points[0]?.at ?? 0;
  const to = points.at(-1)?.at ?? 1;
  const line = smooth(points, from, to);
  const { rows, keys } = bridges(line);
  const top = Math.max(1, ...line.flatMap((p) => (p.value === null ? [] : [p.value])));
  const ms = (value: number) => `${Math.round(value)} ${unit}`;

  return (
    <figure aria-label={`Peak ${peak} ${unit} over the period`} className="h-[9.5rem] text-ink">
      <ResponsiveContainer width="100%" height="100%">
        <Lines data={rows} margin={{ top: 8, right: 2, bottom: 0, left: 0 }}>
          <YAxis
            domain={[0, top]}
            ticks={[0, top]}
            width={48}
            axisLine={false}
            tickLine={false}
            tick={edgeTick(ms, () => "end")}
          />
          <XAxis
            dataKey="at"
            type="number"
            domain={[from, to]}
            ticks={points.length ? [from, to] : []}
            interval={0}
            tickLine={false}
            axisLine={{ className: "stroke-border" }}
            tick={edgeTick(
              (at) => (at === to ? "Now" : time.format(at)),
              (index) => (index === 0 ? "start" : "end"),
            )}
          />
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: "currentColor", strokeOpacity: 0.2, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const point = payload[0]?.payload as { at: number; value: number | null } | undefined;
              if (!active || !point) return null;
              return (
                <Readout
                  value={point.value === null ? "No samples" : ms(point.value)}
                  note={time.format(point.at)}
                />
              );
            }}
          />
          {/* Under the ink line, so its round ends cover the bridges' ends. */}
          {keys.map((key) => (
            <Line
              key={key}
              dataKey={key}
              type="linear"
              className="text-ink-3"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="value"
            type="monotone"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, fill: "currentColor", stroke: "white", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </Lines>
      </ResponsiveContainer>
    </figure>
  );
}

const BLOCKS = 48;
const BLOCK_MS = 30 * 60_000;

interface Block {
  at: number;
  seen: number;
  down: number;
  // Every block is drawn full height; its color carries the state.
  full: 1;
}

const blockState = (block: Block) =>
  block.seen === 0 ? "none" : block.down ? "down" : ("up" as const);

const blockFill = { none: "fill-field", down: "fill-red", up: "fill-green" } as const;

const blockNote = (block: Block) =>
  block.seen === 0
    ? "No samples"
    : block.down
      ? `${block.down} of ${block.seen} minutes down`
      : "Up";

// The last 24 hours in half-hour blocks: green when every sample was up, red when any was down,
// grey with no samples (nothing was running to take one).
export function AvailabilityStrip({
  samples,
  now,
}: {
  samples: { at: number; up: boolean }[];
  now: number;
}) {
  const start = now - BLOCKS * BLOCK_MS;
  const blocks: Block[] = Array.from({ length: BLOCKS }, (_, i) => ({
    at: start + i * BLOCK_MS,
    seen: 0,
    down: 0,
    full: 1,
  }));
  for (const sample of samples) {
    const block = blocks[Math.floor((sample.at - start) / BLOCK_MS)];
    if (!block) continue;
    block.seen += 1;
    if (!sample.up) block.down += 1;
  }

  return (
    <figure>
      <div className="h-8" aria-label="Availability over the last 24 hours">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={blocks}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={1}
          >
            <XAxis dataKey="at" hide />
            <YAxis domain={[0, 1]} hide />
            <Tooltip
              isAnimationActive={false}
              cursor={false}
              content={({ active, payload }) => {
                const block = payload[0]?.payload as Block | undefined;
                if (!active || !block) return null;
                return (
                  <Readout
                    value={blockNote(block)}
                    note={`${time.format(block.at)}–${time.format(block.at + BLOCK_MS)}`}
                  />
                );
              }}
            />
            <Bar
              dataKey="full"
              radius={2}
              isAnimationActive={false}
              activeBar={{ fillOpacity: 0.7 }}
            >
              {blocks.map((block) => (
                <Cell key={block.at} className={blockFill[blockState(block)]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 flex justify-between text-[0.6875rem] text-ink-2">
        <span>24 h ago</span>
        <span>Now</span>
      </figcaption>
    </figure>
  );
}

// Share of minutes up since the history began (at most 24 hours), e.g. "97.2%". A minute without a
// sample counts as down: no server was running to take one. Null without samples.
export const availability = (samples: { at: number; up: boolean }[], now: number) => {
  const first = samples[0]?.at;
  if (first === undefined) return null;
  const minutes = Math.max(1, Math.round((now - first) / 60_000) + 1);
  const up = samples.filter((s) => s.up).length;
  const share = Math.min(100, (up / Math.min(minutes, 24 * 60)) * 100);
  return `${share >= 99.95 ? "100" : share.toFixed(1)}%`;
};
