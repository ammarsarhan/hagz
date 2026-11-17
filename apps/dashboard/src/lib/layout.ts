import { FOOTPRINT_RANGES, FOOTPRINTS, type Orientation } from "@hagz/contracts";
import type { Ground } from "./grounds";

// The venue layout's geometry (Figma "Layout", 376:2–378:2). A cell is 22 pt at zoom 1, which is
// how the frames draw a 16 × 19 venue across a phone: a 5-a-side pitch (4 × 2 cells) is 88 × 44.
export const CELL = 22;

type Size = { width: number; height: number };
type Range = readonly [number, number];

// A size as it lies on the grid: grounds are stored landscape (length × breadth), and VERTICAL
// turns them. Turning twice is the way back, so this also takes a lying size back to landscape.
export const oriented = (size: Size, orientation: Orientation): Size => {
  "worklet";
  return orientation === "VERTICAL"
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
};

// The size a ground is placed at to start with (its sport's default), landscape.
export const defaultFootprint = (ground: Pick<Ground, "sport" | "size">): Size =>
  FOOTPRINTS[ground.sport][ground.size] ?? { width: 1, height: 1 };

// A ground's default size as it lies.
export const footprintOf = (ground: Pick<Ground, "sport" | "size">, orientation: Orientation) =>
  oriented(defaultFootprint(ground), orientation);

// How far a ground can be sized as it lies (FOOTPRINT_RANGES, turned with it).
export const footprintRange = (
  ground: Pick<Ground, "sport" | "size">,
  orientation: Orientation,
): { width: Range; height: Range } => {
  const range = FOOTPRINT_RANGES[ground.sport][ground.size] ?? {
    width: [1, 1] as const,
    height: [1, 1] as const,
  };
  return orientation === "VERTICAL" ? { width: range.height, height: range.width } : range;
};

// --- Placing things ---

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// What's on the layout, as rectangles in cells, each with a key to find it by ("g:<groundId>",
// "a:<index>") and the name to say it by when something lands on it.
export interface Tile {
  key: string;
  name: string;
  rect: Rect;
}

export const overlaps = (a: Rect, b: Rect) => {
  "worklet";
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
};

export const fitsIn = (rect: Rect, columns: number, rows: number) => {
  "worklet";
  return (
    rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= columns && rect.y + rect.height <= rows
  );
};

// The tiles a rectangle would land on, leaving out the one being moved.
export const clashes = (rect: Rect, tiles: Tile[], except: string) => {
  "worklet";
  return tiles.filter((tile) => tile.key !== except && overlaps(rect, tile.rect));
};

// The free spot for something this size nearest a cell (the middle of what's on screen), or null
// when there's no room anywhere.
export const roomFor = (
  size: { width: number; height: number },
  tiles: Tile[],
  columns: number,
  rows: number,
  near: { x: number; y: number },
): { x: number; y: number } | null => {
  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (let y = 0; y + size.height <= rows; y++) {
    for (let x = 0; x + size.width <= columns; x++) {
      const rect = { x, y, ...size };
      if (tiles.some((tile) => overlaps(rect, tile.rect))) continue;
      const distance = Math.hypot(x + size.width / 2 - near.x, y + size.height / 2 - near.y);
      if (distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  return best;
};
