import type { Tx } from "@/platform/db/transaction";
import { footprintOf, inside, overlap, type Rect } from "../domain/layout";

// Keeps the layout valid when a ground's footprint changes (a new sport or size): the ground stays
// where it is if its new footprint still fits, otherwise it leaves the layout and the owner places
// it again (docs: venue layout design).
export const afterFootprintChange = async (tx: Tx, groundId: string) => {
  const item = await tx.venueLayoutItem.findFirst({
    where: { groundId },
    select: { id: true, venueId: true, x: true, y: true, orientation: true },
  });
  if (!item) return;
  const [layout, ground, others] = await Promise.all([
    tx.venueLayout.findUniqueOrThrow({ where: { venueId: item.venueId } }),
    tx.ground.findUniqueOrThrow({ where: { id: groundId }, select: { sport: true, size: true } }),
    tx.venueLayoutItem.findMany({
      where: { venueId: item.venueId, id: { not: item.id } },
      select: {
        x: true,
        y: true,
        width: true,
        height: true,
        orientation: true,
        ground: { select: { sport: true, size: true } },
      },
    }),
  ]);
  const placed: Rect = {
    x: item.x,
    y: item.y,
    ...footprintOf(ground.sport, ground.size, item.orientation ?? "HORIZONTAL"),
  };
  const rects: Rect[] = others.map((other) => ({
    x: other.x,
    y: other.y,
    ...(other.ground
      ? footprintOf(other.ground.sport, other.ground.size, other.orientation ?? "HORIZONTAL")
      : { width: other.width ?? 1, height: other.height ?? 1 }),
  }));
  const fits =
    inside(placed, layout.columns, layout.rows) && !rects.some((r) => overlap(r, placed));
  if (!fits) await tx.venueLayoutItem.delete({ where: { id: item.id } });
};
