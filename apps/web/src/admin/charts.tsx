"use client";

// The admin home's charts, drawn with Recharts: a single line with its peak top left and 0 bottom
// left (Stripe's style), the overview of every response time with downtime as bars behind it
// (Gumloop's Insights, the user's reference of 2026-11-11), and availability strips of blocks. All
// answer hover with a tooltip. None take focus (accessibilityLayer off, the user's call of
// 2026-11-11): the figures beside each chart and the tables below carry the same numbers as text.
//
// Recharts writes colors as SVG attributes, where CSS variables don't resolve, so marks stroke and
// fill with currentColor under a text-* class, or take a fill-*/stroke-* class on the element itself.

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart as Lines,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MINUTE = 60_000;
const time = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false });

export interface Point {
  at: number;
  value: number | null;
}

// Minute samples are averaged into at most this many points: 15 minutes each over a full day, smooth
// like Stripe's charts instead of a jagged block. A point is never shorter than a minute, so a short
// range draws one point a minute instead of scattering into dots.
const MAX_POINTS = 96;

const bucketCount = (from: number, to: number) =>
  Math.max(1, Math.min(MAX_POINTS, Math.round((to - from) / MINUTE) + 1));

// Where in [from, to] bucket i of count sits, ends included.
const bucketAt = (i: number, count: number, from: number, to: number) =>
  count === 1 ? to : from + (i / (count - 1)) * (to - from);

const bucketOf = (at: number, count: number, from: number, to: number) =>
  Math.min(count - 1, Math.floor(((at - from) / Math.max(1, to - from)) * count));

// The average of the points falling in each bucket; null where none did.
const smooth = (points: Point[], from: number, to: number) => {
  const count = bucketCount(from, to);
  const sums = Array.from({ length: count }, () => ({ total: 0, count: 0 }));
  for (const point of points) {
    if (point.value === null || point.at < from) continue;
    const bucket = sums[bucketOf(point.at, count, from, to)];
    if (!bucket) continue;
    bucket.total += point.value;
    bucket.count += 1;
  }
  return sums.map((bucket, i) => ({
    at: bucketAt(i, count, from, to),
    value: bucket.count ? bucket.total / bucket.count : null,
  }));
};

// The gaps inside a line, each bridged by its own grey line from the last point before it to the
// first after it, so the chart never falls apart into pieces while a gap still reads as no data.
// Each bridge has its own key (gap0, gap1, …) with values only at its two ends: one key for all of
// them would also join the end of one gap to the start of the next, across the ink line. Gaps at
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
      <div className="text-label font-semibold text-ink">{value}</div>
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

// One line through the points over [from, to], in ink where there were samples and grey across the
// gaps where there weren't.
export function LineChart({
  points,
  unit,
  from,
  to,
}: {
  points: Point[];
  unit: string;
  from: number;
  to: number;
}) {
  const line = smooth(points, from, to);
  const { rows, keys } = bridges(line);
  const top = Math.max(1, ...line.flatMap((p) => (p.value === null ? [] : [p.value])));
  const ms = (value: number) => `${Math.round(value)} ${unit}`;

  return (
    <figure aria-label={`Peak ${Math.round(top)} ${unit} in the range`} className="h-36 text-ink">
      <ResponsiveContainer width="100%" height="100%">
        <Lines
          data={rows}
          margin={{ top: 8, right: 2, bottom: 0, left: 0 }}
          accessibilityLayer={false}
        >
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
            ticks={[from, to]}
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
              strokeOpacity={0.45}
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

// --- The overview ---

export interface Series {
  key: string;
  label: string;
  points: Point[];
  // A text-* class: the admin web is neutral ink, so series differ in shade (and the lightest is
  // dashed), not hue.
  shade: string;
  dashed?: boolean;
}

// Labels and dots for a chart's series, as in the reference ("● Credit Spend ● Chats").
export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-caption text-ink-2">
          <span className={`size-2 rounded-full ${item.className}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

const TIME_TICKS = 6;

// Evenly spaced labels along the time axis, the ends included.
const timeTicks = (from: number, to: number) =>
  Array.from({ length: TIME_TICKS }, (_, i) => from + (i / (TIME_TICKS - 1)) * (to - from));

// A round top for the y axis with four even steps under it: each step 1, 2, 2.5 or 5 times a power
// of ten.
const niceTop = (max: number) => {
  const step = max / 4;
  const power = 10 ** Math.floor(Math.log10(Math.max(step, 1e-9)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= step) ?? step;
  return nice * 4;
};

// Every response time on one scale, with the minutes something was down as faint red bars behind
// the lines. Lines join across minutes with no samples (the bars already show those), so the chart
// is one piece.
export function OverviewChart({
  series,
  down,
  from,
  to,
  unit,
}: {
  series: Series[];
  // Each minute of the range that was down: no sample, or something down in it.
  down: number[];
  from: number;
  to: number;
  unit: string;
}) {
  const count = bucketCount(from, to);
  const lines = series.map((s) => smooth(s.points, from, to));
  const minutes = Array.from({ length: count }, () => 0);
  for (const at of down) {
    if (at >= from) minutes[bucketOf(at, count, from, to)]! += 1;
  }
  const bucketMinutes = Math.max(1, (to - from) / MINUTE / count);
  const rows = Array.from({ length: count }, (_, i) => ({
    at: bucketAt(i, count, from, to),
    down: minutes[i] ? Math.min(minutes[i], bucketMinutes) : null,
    ...Object.fromEntries(series.map((s, j) => [s.key, lines[j]![i]!.value])),
  }));
  const max = Math.max(
    1,
    ...lines.flatMap((line) => line.flatMap((p) => (p.value === null ? [] : [p.value]))),
  );
  const top = niceTop(max);
  const ms = (value: number) => `${Math.round(value * 10) / 10} ${unit}`;

  return (
    <figure aria-label="Response times over the range" className="h-64 text-ink">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
          accessibilityLayer={false}
        >
          <CartesianGrid yAxisId="ms" vertical={false} className="stroke-border" />
          <YAxis
            yAxisId="ms"
            domain={[0, top]}
            ticks={[0, top / 4, top / 2, (top * 3) / 4, top]}
            width={52}
            axisLine={false}
            tickLine={false}
            tick={edgeTick(ms, () => "end")}
          />
          {/* On the right with no width: on the left (the default) it would take the labelled axis's
              place and push its labels off the chart. */}
          <YAxis yAxisId="down" orientation="right" width={0} domain={[0, bucketMinutes]} hide />
          <XAxis
            dataKey="at"
            type="number"
            domain={[from, to]}
            ticks={timeTicks(from, to)}
            interval={0}
            tickLine={false}
            axisLine={false}
            tick={edgeTick(
              (at) => (at === to ? "Now" : time.format(at)),
              (index) => (index === 0 ? "start" : index === TIME_TICKS - 1 ? "end" : "middle"),
            )}
          />
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: "currentColor", strokeOpacity: 0.2, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const row = payload[0]?.payload as Record<string, number | null> | undefined;
              if (!active || !row) return null;
              return (
                <Readout
                  value={
                    // Smaller and regular weight, a line apart: four figures read as a list, not
                    // four headlines.
                    <ul className="flex flex-col gap-1.5 py-0.5 text-caption font-normal">
                      {series.map((s) => (
                        <li key={s.key} className="flex items-center justify-between gap-4">
                          <span className="text-ink-2">{s.label}</span>
                          <span>{row[s.key] == null ? "—" : ms(row[s.key]!)}</span>
                        </li>
                      ))}
                      {row.down ? (
                        <li className="flex items-center justify-between gap-4 text-red">
                          <span>Down</span>
                          <span>{Math.round(row.down)} min</span>
                        </li>
                      ) : null}
                    </ul>
                  }
                  note={time.format(row.at!)}
                />
              );
            }}
          />
          <Bar
            yAxisId="down"
            dataKey="down"
            className="fill-red"
            fillOpacity={0.12}
            isAnimationActive={false}
            barSize={Math.max(2, Math.min(40, 600 / count))}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              yAxisId="ms"
              dataKey={s.key}
              type="monotone"
              className={s.shade}
              stroke="currentColor"
              strokeWidth={1.75}
              strokeDasharray={s.dashed ? "4 3" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 3.5, fill: "currentColor", stroke: "white", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

// --- Availability ---

const BLOCKS = 48;

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

// [from, to] in 48 blocks: green when every sample was up, red when any was down, grey with no
// samples (nothing was running to take one).
export function AvailabilityStrip({
  samples,
  from,
  to,
  label,
}: {
  samples: { at: number; up: boolean }[];
  from: number;
  to: number;
  label: string;
}) {
  const size = (to - from) / BLOCKS;
  const blocks: Block[] = Array.from({ length: BLOCKS }, (_, i) => ({
    at: from + i * size,
    seen: 0,
    down: 0,
    full: 1,
  }));
  for (const sample of samples) {
    const block = blocks[Math.floor((sample.at - from) / size)];
    if (!block) continue;
    block.seen += 1;
    if (!sample.up) block.down += 1;
  }

  return (
    <div className="h-6" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={blocks}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          barCategoryGap={1}
          accessibilityLayer={false}
          // Recharts handles mouse moves one frame late and doesn't cancel that on mouse leave, so
          // leaving a 24px strip within a frame turns the readout back on after it was hidden, and
          // it stays. Handling moves right away leaves nothing pending to undo the leave.
          throttledEvents={[]}
        >
          <XAxis dataKey="at" hide />
          <YAxis domain={[0, 1]} hide />
          <Tooltip
            isAnimationActive={false}
            cursor={false}
            // The strip is 24px tall, so the readout spills over the strips below it. Those are
            // positioned and come later in the page, so without a z-index they paint on top of it.
            wrapperStyle={{ zIndex: 10 }}
            content={({ active, payload }) => {
              const block = payload[0]?.payload as Block | undefined;
              if (!active || !block) return null;
              return (
                <Readout
                  value={blockNote(block)}
                  note={`${time.format(block.at)}–${time.format(block.at + size)}`}
                />
              );
            }}
          />
          <Bar dataKey="full" radius={2} isAnimationActive={false} activeBar={{ fillOpacity: 0.7 }}>
            {blocks.map((block) => (
              <Cell key={block.at} className={blockFill[blockState(block)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
