// A football, a padel ball and a basketball side by side across the footer's full width, very faint
// (7%), their bottoms cut off by the page's edge (Figma W2 round 5). Drawn like the app's
// illustrations: black, white and grey only, with thick black outlines.

const W = 1440;
const H = 300;
const R = W / 6 - 8;
const CY = R + 24;
const SW = R / 17;

function Football({ cx }: { cx: number }) {
  const k = R / 14;
  const at = (dx: number, dy: number) => `${cx + dx * k} ${CY + dy * k}`;
  const corners: [number, number][] = [
    [0, -7],
    [6, -3],
    [4, 4],
    [-4, 4],
    [-6, -3],
  ];
  const seams: [number, number][] = [
    [0, -13.5],
    [12.6, -5.6],
    [8.4, 11],
    [-8.4, 11],
    [-12.6, -5.6],
  ];
  return (
    <g>
      <circle cx={cx} cy={CY} r={R} fill="#fff" stroke="#000" strokeWidth={SW} />
      <path d={`M${corners.map(([x, y]) => at(x, y)).join(" L")}Z`} fill="#000" />
      {corners.map(([x, y], i) => {
        const [ex, ey] = seams[i] ?? [0, 0];
        return (
          <line
            key={i}
            x1={cx + x * k}
            y1={CY + y * k}
            x2={cx + ex * k}
            y2={CY + ey * k}
            stroke="#000"
            strokeWidth={SW}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

// Two curved seams, mirrored either side of the middle.
const seam = (cx: number, side: 1 | -1, out: number, inner: number, reach: number) =>
  `M${cx + side * R * out} ${CY - R * reach} C${cx + side * R * inner} ${CY - R * 0.3}, ` +
  `${cx + side * R * inner} ${CY + R * 0.3}, ${cx + side * R * out} ${CY + R * reach}`;

function Padel({ cx }: { cx: number }) {
  return (
    <g>
      <circle cx={cx} cy={CY} r={R} fill="#8e8e8e" stroke="#000" strokeWidth={SW} />
      {([-1, 1] as const).map((side) => (
        <path
          key={side}
          d={seam(cx, side, 0.72, 0.15, 0.69)}
          fill="none"
          stroke="#fff"
          strokeWidth={SW * 1.1}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Basketball({ cx }: { cx: number }) {
  const line = SW * 0.85;
  return (
    <g>
      <circle cx={cx} cy={CY} r={R} fill="#000" />
      <line x1={cx - R} y1={CY} x2={cx + R} y2={CY} stroke="#fff" strokeWidth={line} />
      <line x1={cx} y1={CY - R} x2={cx} y2={CY + R} stroke="#fff" strokeWidth={line} />
      {([-1, 1] as const).map((side) => (
        <path
          key={side}
          d={seam(cx, side, 0.66, 0.25, 0.75)}
          fill="none"
          stroke="#fff"
          strokeWidth={line}
        />
      ))}
    </g>
  );
}

export function FooterBalls() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="block h-auto w-full">
      <g opacity={0.07}>
        <Football cx={W / 6} />
        <Padel cx={W / 2} />
        <Basketball cx={(W * 5) / 6} />
      </g>
    </svg>
  );
}
