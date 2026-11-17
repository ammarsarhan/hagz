import type { Tx } from "@/platform/db/transaction";
import { footprintAfterChange, inside, oriented, overlap, type Rect } from "../domain/layout";

// Keeps the layout valid when a ground's kind changes (a new sport or size): it keeps the size it
// was given if the new kind allows it, or takes the new kind's default, and stays where it is if
// that fits; otherwise it leaves the layout and the owner places it again (docs: venue layout
// design).
export const afterFootprintChange = async (tx: Tx, groundId: string) => {
  const item = await tx.venueLayoutItem.findFirst({
    where: { groundId },
    select: {
      id: true,
      venueId: true,
      x: true,
      y: true,
      width: true,
      height: true,
      orientation: true,
    },
  });
  if (!item) return;
  const [layout, ground, others] = await Promise.all([
    tx.venueLayout.findUniqueOrThrow({ where: { venueId: item.venueId } }),
    tx.ground.findUniqueOrThrow({ where: { id: groundId }, select: { sport: true, size: true } }),
    tx.venueLayoutItem.findMany({
      where: { venueId: item.venueId, id: { not: item.id } },
      select: { x: true, y: true, width: true, height: true, orientation: true },
    }),
  ]);
  const size = footprintAfterChange(ground.sport, ground.size, item);
  const placed: Rect = {
    x: item.x,
    y: item.y,
    ...oriented(size, item.orientation ?? "HORIZONTAL"),
  };
  // Every tile keeps its size as it lies: a ground's length and breadth, turned if VERTICAL.
  const rects: Rect[] = others.map((other) => ({
    x: other.x,
    y: other.y,
    ...oriented(other, other.orientation ?? "HORIZONTAL"),
  }));
  const fits =
    inside(placed, layout.columns, layout.rows) && !rects.some((r) => overlap(r, placed));
  if (!fits) {
    await tx.venueLayoutItem.delete({ where: { id: item.id } });
    return;
  }
  if (size.width !== item.width || size.height !== item.height) {
    await tx.venueLayoutItem.update({ where: { id: item.id }, data: size });
  }
};
