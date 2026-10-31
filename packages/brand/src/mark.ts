// The Hagz mark: Tabler's ball-football (thicker, ring 2.3 and seams 1.8) with a three-tongue flame
// streaming to the top right. Approved in Figma (file aXNHHSX9gOR9ejSJotNDgE, frame 54:2). Coordinates
// are in the mark's own units; every output is a framing (a viewBox) of the same geometry, so the
// proportions never drift between platforms.

export const RING = "M2 17 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0";
export const PENTAGON = "M11 12 l4.76 3.45 l-1.76 5.55 h-6 l-1.76 -5.55 z";
export const SEAMS =
  "M11 12 v-3 M14 21 l2 2.4 M15.76 15.45 l2.9 -1.1 M7.24 21 l-2 2.3 M6.24 15.45 l-2.9 -1.1";
// Both ends leave the ring tangentially; the closing arc runs under the ring's stroke.
export const FLAME =
  "M7.34 8.78 L6.87 7.73 C12.35 5.29, 22 0.4, 31.6 0.8 C27.2 1.9, 23.6 3.4, 21.6 5.2 " +
  "C24.2 4.3, 26.9 4.8, 29.1 6.3 C26.4 7.7, 23.7 8.9, 21.9 9.7 C23.7 9.5, 25 10.3, 25.7 11.4 " +
  "C24 13.2, 21.9 13.64, 21 18.76 L19.86 18.56 A9 9 0 0 0 7.34 8.78 Z";
export const RING_WIDTH = 2.3;
export const SEAM_WIDTH = 1.8;

// Logo colours. Customer: lime and black. Staff: white and electric blue. Never blue with black.
export const COLORS = {
  lime: "#E9FEA0",
  black: "#000000",
  white: "#FFFFFF",
  blue: "#1F38ED",
} as const;

export interface ViewBox {
  x: number;
  y: number;
  size: number;
}

const square = (cx: number, cy: number, size: number): ViewBox => ({
  x: cx - size / 2,
  y: cy - size / 2,
  size,
});

// Ball centre and the mark's minimum enclosing circle (computed from the outline with Welzl's algorithm).
const BALL = { x: 11, y: 17 };
const ENCLOSING = { x: 17.3, y: 12.02, r: 18.18 };
// Tight bounding box of the whole mark.
const BOUNDS = { minX: 0.85, minY: 0.78, maxX: 31.6, maxY: 27.15 };

export const FRAMINGS = {
  // A square tile (iOS app icon, web tiles): optically centred, with the heavy ball at 40% across and
  // 58% down so the flame fills the top right. The mark is 1/1.24 of the tile.
  tile: (() => {
    const size = 34 * 1.24;
    return { x: BALL.x - 0.4 * size, y: BALL.y - 0.58 * size, size };
  })(),
  // The same, tighter (1/1.12) for favicons, where every pixel counts. The flame tip still clears a
  // 22% corner radius.
  favicon: (() => {
    const size = 34 * 1.12;
    return { x: BALL.x - 0.4 * size, y: BALL.y - 0.58 * size, size };
  })(),
  // Android adaptive foreground: a 108-unit canvas whose centre 72 units are visible and whose centre
  // 66 are guaranteed by every launcher mask. The enclosing circle fills 62 of the visible 72.
  androidForeground: square(ENCLOSING.x, ENCLOSING.y, ((2 * ENCLOSING.r) / (62 / 72)) * (108 / 72)),
  // No tile (browser tabs): the bounding box with a little air, centred.
  bare: square(
    (BOUNDS.minX + BOUNDS.maxX) / 2,
    (BOUNDS.minY + BOUNDS.maxY) / 2,
    Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxY - BOUNDS.minY) * 1.06,
  ),
} satisfies Record<string, ViewBox>;

export interface MarkOptions {
  framing: ViewBox;
  color: string;
  background?: string;
  // Corner radius as a fraction of the tile (0 = square, full bleed). Only used with a background.
  radius?: number;
  // Extra <style>, e.g. a dark-mode colour for favicons (target `.mark { color: … }`).
  style?: string;
  // Rendered size in pixels. Rasterisers draw an SVG at its declared size, so set this when making a
  // PNG; leave it out for SVGs that should scale.
  px?: number;
  // Optical size. "small" (32 px and under) thickens the ring and replaces the five thin seams with a
  // solid pentagon, which survive at favicon sizes; the silhouette and proportions don't change.
  detail?: "full" | "small";
}

const SMALL_RING_WIDTH = 3.1;

// An SVG of the mark. Paths stay in mark units; the viewBox does the framing.
export const markSvg = ({
  framing,
  color,
  background,
  radius = 0,
  style,
  px,
  detail = "full",
}: MarkOptions): string => {
  const { x, y, size } = framing;
  const tile = background
    ? `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * radius}" fill="${background}"/>`
    : "";
  const dimensions = px ? ` width="${px}" height="${px}"` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg"${dimensions} viewBox="${x} ${y} ${size} ${size}">`,
    style ? `<style>${style}</style>` : "",
    tile,
    // currentColor, so a <style> can recolour the whole mark (e.g. white in dark browser tabs).
    `<g class="mark" color="${color}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">`,
    `<path d="${FLAME}" fill="currentColor" stroke="none"/>`,
    ...(detail === "small"
      ? [
          `<path d="${RING}" stroke-width="${SMALL_RING_WIDTH}"/>`,
          `<path d="${PENTAGON}" fill="currentColor" stroke-width="${SEAM_WIDTH}"/>`,
        ]
      : [
          `<path d="${RING}" stroke-width="${RING_WIDTH}"/>`,
          `<path d="${PENTAGON}" stroke-width="${SEAM_WIDTH}"/>`,
          `<path d="${SEAMS}" stroke-width="${SEAM_WIDTH}"/>`,
        ]),
    `</g></svg>`,
  ].join("");
};
