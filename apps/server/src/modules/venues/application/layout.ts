import type { VenueLayout, VenueLayoutView } from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { VENUE_LAYOUT_CHANGED } from "../domain/events";
import { defaultSize, validateLayout } from "../domain/layout";
import type { VenueAccess } from "./access";
import { lockForEdit } from "./venue-edit";

// The venue layout (PR 2.5), saved whole in one transaction so it's never half-valid. Part of
// operations: editable while provisioning, locked in review.

const placeable = (db: Tx | typeof prisma, venueId: string) =>
  db.ground.findMany({
    where: { venueId, status: { not: "DELETED" } },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: { id: true, sport: true, size: true },
  });

const read = async (db: Tx | typeof prisma, venueId: string): Promise<VenueLayoutView> => {
  const [grounds, layout] = await Promise.all([
    placeable(db, venueId),
    db.venueLayout.findUnique({
      where: { venueId },
      select: {
        columns: true,
        rows: true,
        entrances: true,
        items: {
          orderBy: { id: "asc" },
          select: {
            type: true,
            groundId: true,
            x: true,
            y: true,
            orientation: true,
            width: true,
            height: true,
          },
        },
      },
    }),
  ]);
  const placed: VenueLayout["grounds"] = [];
  const facilities: VenueLayout["facilities"] = [];
  for (const item of layout?.items ?? []) {
    if (item.type === "GROUND" && item.groundId) {
      placed.push({
        groundId: item.groundId,
        x: item.x,
        y: item.y,
        orientation: item.orientation ?? "HORIZONTAL",
      });
    } else if (item.type !== "GROUND") {
      facilities.push({
        type: item.type,
        x: item.x,
        y: item.y,
        width: item.width ?? 1,
        height: item.height ?? 1,
      });
    }
  }
  const onLayout = new Set(placed.map((ground) => ground.groundId));
  return {
    ...(layout ? { columns: layout.columns, rows: layout.rows } : defaultSize(grounds)),
    grounds: placed,
    facilities,
    entrances: (layout?.entrances ?? []) as VenueLayout["entrances"],
    saved: layout !== null,
    unplacedGroundIds: grounds.filter((g) => !onLayout.has(g.id)).map((g) => g.id),
  };
};

export const venueLayout = (venueId: string) => read(prisma, venueId);

export const saveLayout = async (actor: VenueAccess, input: VenueLayout) => {
  await transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const grounds = await placeable(tx, actor.venueId);
    validateLayout(input, new Map(grounds.map((g) => [g.id, { sport: g.sport, size: g.size }])));
    const previous = await read(tx, actor.venueId);

    const entrances = input.entrances as unknown as Prisma.InputJsonValue;
    await tx.venueLayout.upsert({
      where: { venueId: actor.venueId },
      create: { venueId: actor.venueId, columns: input.columns, rows: input.rows, entrances },
      update: { columns: input.columns, rows: input.rows, entrances },
    });
    await tx.venueLayoutItem.deleteMany({ where: { venueId: actor.venueId } });
    await tx.venueLayoutItem.createMany({
      data: [
        ...input.grounds.map((ground) => ({
          venueId: actor.venueId,
          type: "GROUND" as const,
          groundId: ground.groundId,
          x: ground.x,
          y: ground.y,
          orientation: ground.orientation,
        })),
        ...input.facilities.map((facility) => ({ venueId: actor.venueId, ...facility })),
      ],
    });
    await tx.venueEvent.create({
      data: {
        venueId: actor.venueId,
        staffId: actor.staffId,
        type: VENUE_LAYOUT_CHANGED,
        data: {
          previous: previous.saved
            ? {
                columns: previous.columns,
                rows: previous.rows,
                grounds: previous.grounds,
                facilities: previous.facilities,
                entrances: previous.entrances,
              }
            : null,
          next: input,
        },
      },
    });
  });
  return venueLayout(actor.venueId);
};
