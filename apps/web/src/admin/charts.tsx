// Small SVG charts in Stripe's style (the user's reference), with no chart library: a line with the
// peak labelled top left and 0 bottom left, and an availability strip of half-hour blocks.

const time = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false });

export interface Point {
  at: number;
  value: number | null;
}

const WIDTH = 320;
const HEIGHT = 120;
// Minute samples are averaged into at most this many points: 15 minutes each over a full day, smooth
// like Stripe's charts instead of a jagged block. A point is never shorter than a minute, so a short
// history draws one point a minute instead of scattering into dots. A point with no samples breaks
// the line.
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
    x: count === 1 ? WIDTH : (i / (count - 1)) * WIDTH,
    value: bucket.count ? bucket.total / bucket.count : null,
  }));
};

// One line through the points, broken wherever there were no samples. The peak label is the true
// highest minute, not the averaged one.
export function LineChart({ points, unit }: { points: Point[]; unit: string }) {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const peak = Math.max(1, ...values);
  const from = points[0]?.at ?? 0;
  const to = points.at(-1)?.at ?? 1;
  const line = smooth(points, from, to);
  const top = Math.max(1, ...line.flatMap((p) => (p.value === null ? [] : [p.value])));
  const y = (value: number) => HEIGHT - (value / top) * (HEIGHT - 6) - 1;

  const runs: string[] = [];
  let run: string[] = [];
  for (const point of line) {
    if (point.value === null) {
      if (run.length) runs.push(run.join(" "));
      run = [];
      continue;
    }
    run.push(`${point.x.toFixed(1)},${y(point.value).toFixed(1)}`);
  }
  if (run.length) runs.push(run.join(" "));

  return (
    <figure>
      <div className="flex gap-2">
        <div className="flex w-10 shrink-0 flex-col justify-between py-0.5 text-right text-[0.6875rem] text-ink-2">
          <span>
            {Math.round(top)} {unit}
          </span>
          <span>0 {unit}</span>
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-[8.5rem] min-w-0 flex-1"
          role="img"
          aria-label={`Peak ${peak} ${unit} over the period`}
        >
          <line x1="0" y1={HEIGHT - 0.5} x2={WIDTH} y2={HEIGHT - 0.5} className="stroke-border" />
          {runs.map((pts, i) =>
            pts.includes(" ") ? (
              <polyline
                key={i}
                points={pts}
                fill="none"
                className="stroke-ink"
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <line
                key={i}
                x1={Number(pts.split(",")[0]) - 1}
                x2={Number(pts.split(",")[0]) + 1}
                y1={pts.split(",")[1]}
                y2={pts.split(",")[1]}
                className="stroke-ink"
                strokeWidth="1.75"
                vectorEffect="non-scaling-stroke"
              />
            ),
          )}
        </svg>
      </div>
      <figcaption className="mt-1 ml-12 flex justify-between text-[0.6875rem] text-ink-2">
        <span>{points.length ? time.format(from) : ""}</span>
        <span>Now</span>
      </figcaption>
    </figure>
  );
}

const BLOCKS = 48;
const BLOCK_MS = 30 * 60_000;

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
  const blocks = Array.from({ length: BLOCKS }, () => ({ seen: 0, down: 0 }));
  for (const sample of samples) {
    const i = Math.floor((sample.at - start) / BLOCK_MS);
    const block = blocks[i];
    if (!block) continue;
    block.seen += 1;
    if (!sample.up) block.down += 1;
  }
  return (
    <figure>
      <div
        className="flex h-8 gap-[0.125rem]"
        role="img"
        aria-label="Availability over the last 24 hours"
      >
        {blocks.map((block, i) => (
          <span
            key={i}
            title={
              block.seen === 0
                ? "No samples"
                : block.down
                  ? `${block.down} of ${block.seen} minutes down`
                  : "Up"
            }
            className={`flex-1 rounded-[0.125rem] ${block.seen === 0 ? "bg-field" : block.down ? "bg-red" : "bg-green"}`}
          />
        ))}
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
