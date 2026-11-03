// The decoration on the blue invitation card, as approved in Figma ("D2 · Blue invitation card,
// decoration variants"): one of four arrangements of a soft shape and sparkles, picked from the
// venue's id so a venue always gets the same art and a row of cards doesn't repeat. Drawn as SVG
// markup for the card's measured size, in its end corner (mirrored in Arabic) to stay clear of the
// text.

const DEEP = "#3a52f2";
const SOFT = "#a0bcff";
const WHITE = "#ffffff";

// The Figma cards are 353 × 202; shapes are placed from their right edge, and the two that sit on
// the bottom edge from the bottom.
const DESIGN_WIDTH = 353;
const DESIGN_HEIGHT = 202;

const n = (value: number) => value.toFixed(1);

type Point = readonly [number, number];

// A four-pointed sparkle with sharp tips and pinched sides.
function spark(cx: number, cy: number, r: number, color: string) {
  const tip = (i: number): Point => {
    const a = ((-90 + (i % 4) * 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  let d = `M${n(tip(0)[0])} ${n(tip(0)[1])} `;
  for (let i = 0; i < 4; i++) {
    const [bx, by] = tip(i + 1);
    const m = ((-45 + i * 90) * Math.PI) / 180;
    const k = r * 0.14;
    d += `Q${n(cx + k * Math.cos(m))} ${n(cy + k * Math.sin(m))} ${n(bx)} ${n(by)} `;
  }
  return `<path d="${d}Z" fill="${color}"/>`;
}

// A softly wobbling round shape: points around a circle, joined with a smooth closed curve.
function blob(cx: number, cy: number, r: number, wobble: number, lobes: number, phase: number) {
  const count = 64;
  const at = (i: number): Point => {
    const t = (2 * Math.PI * (((i % count) + count) % count)) / count;
    const rr =
      r *
      (1 +
        wobble * Math.sin(lobes * t + phase) +
        wobble * 0.5 * Math.sin((lobes + 2) * t + phase * 1.7));
    return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)];
  };
  let d = `M${n(at(0)[0])} ${n(at(0)[1])} `;
  for (let i = 0; i < count; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d +=
      `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])} ${n(p2[1])} `;
  }
  return `<path d="${d}Z" fill="${DEEP}"/>`;
}

type Place = { x: (x: number) => number; bottom: (y: number) => number };

const VARIANTS: ((p: Place) => string)[] = [
  // Orbit: a soft shape tucked in the top corner, two sparkles.
  ({ x }) =>
    blob(x(318), 22, 74, 0.06, 5, 0.4) + spark(x(296), 44, 11, WHITE) + spark(x(322), 76, 6, SOFT),
  // Tide: the shape rises from the bottom corner, sparkles above it.
  ({ x, bottom }) =>
    blob(x(330), bottom(196), 92, 0.08, 6, 1.9) +
    spark(x(318), 30, 9, WHITE) +
    spark(x(296), 52, 5, SOFT),
  // Ring: a thick soft ring in the corner, three sparkles.
  ({ x }) =>
    `<circle cx="${n(x(320))}" cy="28" r="58" fill="none" stroke="${DEEP}" stroke-width="22"/>` +
    spark(x(300), 66, 10, WHITE) +
    spark(x(334), 92, 5, SOFT) +
    spark(x(276), 30, 4, SOFT),
  // Pebbles: two small shapes at opposite corners, sparkles between.
  ({ x, bottom }) =>
    blob(x(334), 34, 40, 0.09, 4, 2.6) +
    blob(x(286), bottom(186), 44, 0.08, 5, 0.9) +
    spark(x(296), 46, 8, WHITE) +
    spark(x(268), 20, 5, SOFT),
];

// The same id always lands on the same variant.
export function artVariant(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % VARIANTS.length;
}

export function invitationArt(variant: number, width: number, height: number, mirrored: boolean) {
  const fromEnd = (x: number) => DESIGN_WIDTH - x;
  const place: Place = {
    x: (x) => (mirrored ? fromEnd(x) : width - fromEnd(x)),
    bottom: (y) => height - (DESIGN_HEIGHT - y),
  };
  const shapes = VARIANTS[variant % VARIANTS.length]?.(place) ?? "";
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${shapes}</svg>`;
}
