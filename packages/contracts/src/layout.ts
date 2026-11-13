import { z } from "zod";

// The venue layout (PR 2.5): a grid of about 10 m cells, sized by the owner (up to 60 × 60), with
// grounds at fixed footprints, facilities sized 1–4 cells, and entrances on the edges.

export const MAXIMUM_LAYOUT_CELLS = 60;
// The size a new layout starts at (the designs' grid), grown to fit the largest ground.
export const DEFAULT_LAYOUT = { columns: 16, rows: 19 } as const;

export const Orientation = z.enum(["HORIZONTAL", "VERTICAL"]).meta({
  id: "Orientation",
  description: "`VERTICAL` swaps the footprint's width and height.",
});

export const FacilityType = z
  .enum(["CAFE", "TOILETS", "CHANGING_ROOMS", "PARKING", "SEATING"])
  .meta({ id: "FacilityType" });

export const EntranceSide = z.enum(["TOP", "RIGHT", "BOTTOM", "LEFT"]).meta({ id: "EntranceSide" });

const cell = z
  .int()
  .min(0)
  .max(MAXIMUM_LAYOUT_CELLS - 1);

export const PlacedGround = z
  .object({ groundId: z.uuid(), x: cell, y: cell, orientation: Orientation })
  .meta({ id: "PlacedGround", description: "Top-left cell; the footprint comes from the ground." });

export const PlacedFacility = z
  .object({
    type: FacilityType,
    x: cell,
    y: cell,
    width: z.int().min(1).max(4),
    height: z.int().min(1).max(4),
  })
  .meta({ id: "PlacedFacility" });

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
    facilities: z.array(PlacedFacility).max(50),
    entrances: z.array(Entrance).max(10),
  })
  .meta({ id: "VenueLayout" });

export const VenueLayoutView = VenueLayout.extend({
  saved: z.boolean().meta({ description: "False until the first save: a suggested empty grid." }),
  unplacedGroundIds: z.array(z.uuid()).meta({ description: "Grounds not on the layout yet." }),
}).meta({ id: "VenueLayoutView" });

export type Orientation = z.infer<typeof Orientation>;
export type FacilityType = z.infer<typeof FacilityType>;
export type EntranceSide = z.infer<typeof EntranceSide>;
export type PlacedGround = z.infer<typeof PlacedGround>;
export type PlacedFacility = z.infer<typeof PlacedFacility>;
export type Entrance = z.infer<typeof Entrance>;
export type VenueLayout = z.infer<typeof VenueLayout>;
export type VenueLayoutView = z.infer<typeof VenueLayoutView>;
