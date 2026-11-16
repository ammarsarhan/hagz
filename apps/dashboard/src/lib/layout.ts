import { FOOTPRINTS, type Orientation } from "@hagz/contracts";
import type { Ground } from "./grounds";

// The venue layout's geometry (Figma "Layout", 376:2–378:2). A cell is 22 pt at zoom 1, which is
// how the frames draw a 16 × 19 venue across a phone: a 5-a-side pitch (4 × 2 cells) is 88 × 44.
export const CELL = 22;

// A ground's size in cells, as placed: footprints are landscape, and VERTICAL turns them.
export const footprintOf = (
  ground: Pick<Ground, "sport" | "size">,
  orientation: Orientation,
): { width: number; height: number } => {
  const landscape = FOOTPRINTS[ground.sport][ground.size] ?? { width: 1, height: 1 };
  return orientation === "VERTICAL"
    ? { width: landscape.height, height: landscape.width }
    : landscape;
};
