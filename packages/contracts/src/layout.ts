import { z } from "zod";

// The venue layout (PR 2.5): a grid of about 10 m cells, sized by the owner (up to 60 × 60), with
// grounds sized within their sport's range (FOOTPRINT_RANGES), the venue's placeable amenities
// (parking, a café) at any size that fits, and entrances on the edges.

export const MAXIMUM_LAYOUT_CELLS = 60;
// The size a new layout starts at (the designs' grid), grown to fit the largest ground.
export const DEFAULT_LAYOUT = { columns: 16, rows: 19 } as const;

export const Orientation = z.enum(["HORIZONTAL", "VERTICAL"]).meta({
  id: "Orientation",
  description: "`VERTICAL` swaps the footprint's width and height.",
});

export const EntranceSide = z.enum(["TOP", "RIGHT", "BOTTOM", "LEFT"]).meta({ id: "EntranceSide" });

const cell = z
  .int()
  .min(0)
  .max(MAXIMUM_LAYOUT_CELLS - 1);

const extent = z.int().min(1).max(MAXIMUM_LAYOUT_CELLS);

export const PlacedGround = z
  .object({
    groundId: z.uuid(),
    x: cell,
    y: cell,
    orientation: Orientation,
    width: extent.meta({
      description: "Length in cells, as if HORIZONTAL: within the ground's FOOTPRINT_RANGES.",
    }),
    height: extent.meta({ description: "Breadth in cells, as if HORIZONTAL." }),
  })
  .meta({ id: "PlacedGround", description: "Top-left cell, and the ground's size on the grid." });

export const PlacedAmenity = z
  .object({
    optionId: z.uuid().meta({
      description:
        "One of the venue's amenities whose option is placeable. It can go down more than once.",
    }),
    x: cell,
    y: cell,
    width: extent.meta({ description: "Any size that fits on the grid without overlapping." }),
    height: extent,
  })
  .meta({ id: "PlacedAmenity" });

export const Entrance = z
  .object({
    side: EntranceSide,
    offset: cell.meta({ description: "Cells from the side's start (left or top)." }),
  })
  .meta({ id: "Entrance" });

export const VenueLayout = z
  .object({
    columns: z.int().min(1).max(MAXIMUM_LAYOUT_CELLS),
    rows: z.int().min(1).max(MAXIMUM_LAYOUT_CELLS),
    grounds: z.array(PlacedGround).max(100),
    amenities: z.array(PlacedAmenity).max(50),
    entrances: z.array(Entrance).max(10),
  })
  .meta({ id: "VenueLayout" });

export const VenueLayoutView = VenueLayout.extend({
  saved: z.boolean().meta({ description: "False until the first save: a suggested empty grid." }),
  unplacedGroundIds: z.array(z.uuid()).meta({ description: "Grounds not on the layout yet." }),
  placeableOptionIds: z.array(z.uuid()).meta({
    description: "The venue's amenities that can go on the layout, placed or not.",
  }),
}).meta({ id: "VenueLayoutView" });

export type Orientation = z.infer<typeof Orientation>;
export type EntranceSide = z.infer<typeof EntranceSide>;
export type PlacedGround = z.infer<typeof PlacedGround>;
export type PlacedAmenity = z.infer<typeof PlacedAmenity>;
export type Entrance = z.infer<typeof Entrance>;
export type VenueLayout = z.infer<typeof VenueLayout>;
export type VenueLayoutView = z.infer<typeof VenueLayoutView>;
