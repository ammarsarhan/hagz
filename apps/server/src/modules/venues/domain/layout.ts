import { FOOTPRINTS, type GroundSize, type GroundSport } from "@hagz/contracts";

// The venue layout (PR 2.5): a grid of about 10 m cells with grounds at fixed footprints and
// facilities sized 1–4 cells, all inside the grid and never overlapping (docs: venue layout design).

export type Orientation = "HORIZONTAL" | "VERTICAL";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const footprintOf = (sport: GroundSport, size: GroundSize, orientation: Orientation) => {
  const base = FOOTPRINTS[sport][size];
  if (!base) throw new Error(`No footprint for ${sport} ${size}`);
  return orientation === "VERTICAL"
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
};

export const inside = (rect: Rect, columns: number, rows: number) =>
  rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= columns && rect.y + rect.height <= rows;

export const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// The first pair of indexes whose rectangles overlap, if any.
export const firstOverlap = (rects: Rect[]): [number, number] | null => {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const [a, b] = [rects[i], rects[j]];
      if (a && b && overlap(a, b)) return [i, j];
    }
  }
  return null;
};
