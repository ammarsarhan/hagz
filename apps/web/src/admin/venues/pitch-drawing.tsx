import type { GroundSport } from "@hagz/contracts";

// A ground drawn from above, landscape, with its sport's markings, for the top of its modal: hairline
// greys on white, like the venue's layout. Its footprint (in layout cells, run-off included) sets its
// shape; the lines sit inside it, the run-off left around them.

const W = 400;

export function PitchMarkings({
  sport,
  width,
  height,
  icon = false,
}: {
  sport: GroundSport;
  // The footprint in cells, landscape.
  width: number;
  height: number;
  // Drawn small, as an icon: darker lines a pixel wide whatever the size.
  icon?: boolean;
}) {
  const H = (W * height) / width;
  // The run-off: the same margin on every side, a share of the shorter side.
  const p = H * 0.12;
  const x0 = p;
  const y0 = p;
  const x1 = W - p;
  const y1 = H - p;
  const pw = x1 - x0;
  const ph = y1 - y0;
  const cx = W / 2;
  const cy = H / 2;
  const fixed = icon ? ({ vectorEffect: "non-scaling-stroke" } as const) : {};
  const line = {
    stroke: icon ? "#5e636b" : "#d5d8dd",
    strokeWidth: icon ? 1 : 1.5,
    fill: "none",
    ...fixed,
  } as const;
  // A net reads a step darker than the lines on the ground.
  const net = {
    stroke: icon ? "#0b0b0c" : "#9aa0a8",
    strokeWidth: icon ? 1 : 2,
    ...fixed,
  } as const;

  const marks = (() => {
    switch (sport) {
      case "FOOTBALL": {
        const box = { d: pw * 0.15, h: ph * 0.52 };
        const goal = { d: pw * 0.055, h: ph * 0.26 };
        return (
          <>
            <line x1={cx} y1={y0} x2={cx} y2={y1} {...line} />
            <circle cx={cx} cy={cy} r={ph * 0.16} {...line} />
            <circle cx={cx} cy={cy} r={2} fill="#d5d8dd" />
            {[x0, x1 - box.d].map((x) => (
              <rect key={x} x={x} y={cy - box.h / 2} width={box.d} height={box.h} {...line} />
            ))}
            {[x0, x1 - goal.d].map((x) => (
              <rect key={x} x={x} y={cy - goal.h / 2} width={goal.d} height={goal.h} {...line} />
            ))}
          </>
        );
      }
      case "TENNIS": {
        const alley = ph * 0.125;
        const service = pw * 0.27;
        return (
          <>
            <line x1={x0} y1={y0 + alley} x2={x1} y2={y0 + alley} {...line} />
            <line x1={x0} y1={y1 - alley} x2={x1} y2={y1 - alley} {...line} />
            {[cx - service, cx + service].map((x) => (
              <line key={x} x1={x} y1={y0 + alley} x2={x} y2={y1 - alley} {...line} />
            ))}
            <line x1={cx - service} y1={cy} x2={cx + service} y2={cy} {...line} />
            <line x1={cx} y1={y0 - p * 0.4} x2={cx} y2={y1 + p * 0.4} {...net} />
          </>
        );
      }
      case "PADEL": {
        const service = pw * 0.35;
        return (
          <>
            {[cx - service, cx + service].map((x) => (
              <line key={x} x1={x} y1={y0} x2={x} y2={y1} {...line} />
            ))}
            <line x1={cx - service} y1={cy} x2={cx + service} y2={cy} {...line} />
            <line x1={cx} y1={y0} x2={cx} y2={y1} {...net} />
          </>
        );
      }
      case "BASKETBALL": {
        const key = { d: pw * 0.2, h: ph * 0.34 };
        const arc = ph * 0.44;
        return (
          <>
            <line x1={cx} y1={y0} x2={cx} y2={y1} {...line} />
            <circle cx={cx} cy={cy} r={ph * 0.13} {...line} />
            {[x0, x1 - key.d].map((x) => (
              <rect key={x} x={x} y={cy - key.h / 2} width={key.d} height={key.h} {...line} />
            ))}
            <path d={`M ${x0} ${cy - arc} A ${arc} ${arc} 0 0 1 ${x0} ${cy + arc}`} {...line} />
            <path d={`M ${x1} ${cy - arc} A ${arc} ${arc} 0 0 0 ${x1} ${cy + arc}`} {...line} />
          </>
        );
      }
      case "VOLLEYBALL": {
        const attack = pw / 6;
        return (
          <>
            {[cx - attack, cx + attack].map((x) => (
              <line key={x} x1={x} y1={y0} x2={x} y2={y1} {...line} />
            ))}
            <line x1={cx} y1={y0 - p * 0.4} x2={cx} y2={y1 + p * 0.4} {...net} />
          </>
        );
      }
    }
  })();

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      className="absolute inset-0 size-full"
      preserveAspectRatio="none"
    >
      <rect x={x0} y={y0} width={pw} height={ph} {...line} />
      {marks}
    </svg>
  );
}
