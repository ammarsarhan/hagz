import {
  DEFAULT_LAYOUT,
  footprintAllowed,
  FOOTPRINT_RANGES,
  FOOTPRINTS,
  MAXIMUM_LAYOUT_CELLS,
  type GroundSize,
  type GroundSport,
  type VenueLayout,
} from "@hagz/contracts";
import { AppError } from "@/platform/errors/app-error";

// The venue layout (PR 2.5): a grid of about 10 m cells with grounds at fixed footprints and
// placeable amenities sized 1–4 cells, all inside the grid and never overlapping (docs: venue
// layout design).

export type Orientation = "HORIZONTAL" | "VERTICAL";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A footprint as it lies on the grid: VERTICAL swaps length and breadth.
export const oriented = (size: { width: number; height: number }, orientation: Orientation) =>
  orientation === "VERTICAL"
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };

// A ground's default footprint (the one it's placed at), as it lies.
export const footprintOf = (sport: GroundSport, size: GroundSize, orientation: Orientation) => {
  const base = FOOTPRINTS[sport][size];
  if (!base) throw new Error(`No footprint for ${sport} ${size}`);
  return oriented(base, orientation);
};

// The size a ground keeps when its sport or size changes: the one it had if the new kind allows it,
// otherwise the new kind's default.
export const footprintAfterChange = (
  sport: GroundSport,
  size: GroundSize,
  had: { width: number; height: number },
) => {
  if (footprintAllowed(sport, size, had)) return had;
  const base = FOOTPRINTS[sport][size];
  if (!base || !FOOTPRINT_RANGES[sport][size]) throw new Error(`No footprint for ${sport} ${size}`);
  return base;
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

export const invalidLayout = (
  reason: string,
  detail: string,
  extra: Record<string, unknown> = {},
) =>
  new AppError({ code: "INVALID_LAYOUT", status: 422, detail, extensions: { reason, ...extra } });

// Checks a whole layout before it's saved: every tile inside the grid, nothing overlapping, each of
// the venue's grounds at most once, amenities only ones the venue offers that can be placed, and
// entrances on their side. `grounds` are the venue's grounds that can be placed (not deleted);
// `amenities` the option ids of its placeable amenities.
export const validateLayout = (
  layout: VenueLayout,
  grounds: Map<string, { sport: GroundSport; size: GroundSize }>,
  amenities: Set<string>,
) => {
  const seen = new Set<string>();
  const tiles: { label: string; rect: Rect }[] = [];
  for (const placed of layout.grounds) {
    const ground = grounds.get(placed.groundId);
    if (!ground) {
      throw invalidLayout("UNKNOWN_GROUND", "That ground isn't one of this venue's.", {
        groundId: placed.groundId,
      });
    }
    if (seen.has(placed.groundId)) {
      throw invalidLayout("DUPLICATE_GROUND", "Each ground goes on the layout once.", {
        groundId: placed.groundId,
      });
    }
    seen.add(placed.groundId);
    if (!footprintAllowed(ground.sport, ground.size, placed)) {
      throw invalidLayout("GROUND_SIZE", "That ground can't be that size.", {
        groundId: placed.groundId,
      });
    }
    tiles.push({
      label: placed.groundId,
      rect: { x: placed.x, y: placed.y, ...oriented(placed, placed.orientation) },
    });
  }
  layout.amenities.forEach((amenity, i) => {
    if (!amenities.has(amenity.optionId)) {
      throw invalidLayout(
        "UNKNOWN_AMENITY",
        "That amenity isn't one this venue offers, or it can't go on a layout.",
        { optionId: amenity.optionId },
      );
    }
    tiles.push({ label: `amenity:${String(i)}`, rect: amenity });
  });

  for (const tile of tiles) {
    if (!inside(tile.rect, layout.columns, layout.rows)) {
      throw invalidLayout("OUT_OF_BOUNDS", "Something is outside the grid.", { item: tile.label });
    }
  }
  const clash = firstOverlap(tiles.map((tile) => tile.rect));
  if (clash) {
    throw invalidLayout("OVERLAP", "Two things are on the same cells.", {
      items: clash.map((i) => tiles[i]?.label),
    });
  }

  const doors = new Set<string>();
  for (const entrance of layout.entrances) {
    const length =
      entrance.side === "TOP" || entrance.side === "BOTTOM" ? layout.columns : layout.rows;
    if (entrance.offset >= length) {
      throw invalidLayout("ENTRANCE_OUT_OF_RANGE", "An entrance is past the end of its side.");
    }
    const id = `${entrance.side}:${String(entrance.offset)}`;
    if (doors.has(id)) throw invalidLayout("DUPLICATE_ENTRANCE", "Two entrances in the same spot.");
    doors.add(id);
  }
};

// A new layout's size: the designs' grid, grown to fit the largest ground either way.
export const defaultSize = (grounds: { sport: GroundSport; size: GroundSize }[]) => {
  let columns: number = DEFAULT_LAYOUT.columns;
  let rows: number = DEFAULT_LAYOUT.rows;
  for (const ground of grounds) {
    const { width, height } = footprintOf(ground.sport, ground.size, "HORIZONTAL");
    columns = Math.max(columns, width + 2);
    rows = Math.max(rows, height + 2);
  }
  return {
    columns: Math.min(columns, MAXIMUM_LAYOUT_CELLS),
    rows: Math.min(rows, MAXIMUM_LAYOUT_CELLS),
  };
};
