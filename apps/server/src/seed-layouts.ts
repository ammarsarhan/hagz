import { pathToFileURL } from "node:url";
import { FOOTPRINT_RANGES, type VenueLayout } from "@hagz/contracts";
import { ALL_PERMISSIONS, saveLayout } from "@/modules/venues";
import { env } from "@/platform/config/env";
import { prisma } from "@/platform/db/prisma";
import { cache, queueConnection } from "@/platform/redis/connections";

// Development only: a layout for every live venue that has none (user, 2026-11-24), so the venue
// page's layout and the staff and admin layout screens have something to show. Each ground at a
// size within its sport's range, a walkway of one cell around everything, the venue's placeable
// amenities (parking, a café, changing rooms) after the grounds, and one or two entrances. Saved
// through the real path (saveLayout, as the venue's owner), so it's checked like any layout.
// Safe to run again: venues with a layout are left alone. seed:alexandria runs it at the end.
//
//   pnpm --filter @hagz/server seed:layouts

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Sport = keyof typeof FOOTPRINT_RANGES;

// mulberry32: the same layouts from the same seed.
const randomFrom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

// Sizes for the amenities that can be placed, [width, height] in cells.
const AMENITY_SIZES: Record<string, [number, number][]> = {
  parking: [
    [4, 2],
    [3, 2],
  ],
  cafe: [
    [2, 1],
    [2, 2],
  ],
  changing_rooms: [
    [2, 1],
    [1, 1],
  ],
};

// Apart by at least one cell (a walkway), and off the grid's edge by one.
const clear = (rect: Rect, placed: Rect[], columns: number, rows: number) =>
  rect.x >= 1 &&
  rect.y >= 1 &&
  rect.x + rect.width <= columns - 1 &&
  rect.y + rect.height <= rows - 1 &&
  placed.every(
    (other) =>
      rect.x >= other.x + other.width + 1 ||
      other.x >= rect.x + rect.width + 1 ||
      rect.y >= other.y + other.height + 1 ||
      other.y >= rect.y + rect.height + 1,
  );

// The first free spot, top to bottom and left to right.
const fit = (width: number, height: number, placed: Rect[], columns: number) => {
  for (let y = 1; y < 59; y++) {
    for (let x = 1; x + width < columns; x++) {
      const rect = { x, y, width, height };
      if (clear(rect, placed, columns, 60)) return rect;
    }
  }
  return null;
};

export const layoutFor = (
  random: () => number,
  grounds: { id: string; sport: Sport; size: string }[],
  amenities: { optionId: string; key: string }[],
): VenueLayout => {
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)] as T;
  const within = ([low, high]: readonly [number, number]) =>
    low + Math.floor(random() * (high - low + 1));
  // Each ground at a size its sport allows; courts and fives turned upright now and then.
  const sized = grounds.map((ground) => {
    const range = (
      FOOTPRINT_RANGES[ground.sport] as Record<string, typeof FOOTPRINT_RANGES.PADEL.STANDARD>
    )[ground.size];
    if (!range) throw new Error(`No footprint range for ${ground.sport} ${ground.size}`);
    const length = within(range.width);
    const breadth = within(range.height);
    const upright = ground.size !== "ELEVEN_A_SIDE" && random() < 0.3;
    return { ground, length, breadth, upright };
  });
  // Biggest first, so they lead and the small ones fill around them.
  sized.sort((a, b) => b.length * b.breadth - a.length * a.breadth);
  const widest = Math.max(...sized.map((s) => (s.upright ? s.breadth : s.length)));
  const columns = Math.min(60, Math.max(16, widest + 2));

  const placed: Rect[] = [];
  const layout: VenueLayout = { columns, rows: 0, grounds: [], amenities: [], entrances: [] };
  for (const { ground, length, breadth, upright } of sized) {
    const rect = upright
      ? fit(breadth, length, placed, columns)
      : fit(length, breadth, placed, columns);
    if (!rect) continue;
    placed.push(rect);
    layout.grounds.push({
      groundId: ground.id,
      x: rect.x,
      y: rect.y,
      orientation: upright ? "VERTICAL" : "HORIZONTAL",
      width: length,
      height: breadth,
    });
  }
  for (const amenity of amenities) {
    const sizes = AMENITY_SIZES[amenity.key] ?? [[1, 1] as [number, number]];
    const [width, height] = pick(sizes);
    const rect = fit(width, height, placed, columns);
    if (!rect) continue;
    placed.push(rect);
    layout.amenities.push({ optionId: amenity.optionId, ...rect });
  }
  // A cell of walkway under the lowest tile, and at least the height of a small venue.
  layout.rows = Math.min(60, Math.max(8, ...placed.map((rect) => rect.y + rect.height + 1)));
  // The way in: on the bottom edge, sometimes another on the left.
  layout.entrances.push({ side: "BOTTOM", offset: 1 + Math.floor(random() * (columns - 2)) });
  if (random() < 0.4) {
    layout.entrances.push({ side: "LEFT", offset: 1 + Math.floor(random() * (layout.rows - 2)) });
  }
  return layout;
};

export const seedLayouts = async (seed = 2026) => {
  if (env.APP_ENV !== "development") {
    throw new Error(`Refusing to seed layouts in ${env.APP_ENV}: local development only.`);
  }
  const random = randomFrom(seed);
  const venues = await prisma.venue.findMany({
    where: { status: "LIVE", layout: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      memberships: { where: { role: "OWNER" }, take: 1, select: { staffId: true } },
      grounds: {
        where: { status: { not: "DELETED" } },
        orderBy: { position: "asc" },
        select: { id: true, sport: true, size: true },
      },
      amenities: {
        where: { option: { placeable: true } },
        select: { optionId: true, option: { select: { key: true } } },
      },
    },
  });
  let made = 0;
  for (const venue of venues) {
    const owner = venue.memberships[0];
    if (!owner || venue.grounds.length === 0) continue;
    const layout = layoutFor(
      random,
      venue.grounds,
      venue.amenities.map((amenity) => ({ optionId: amenity.optionId, key: amenity.option.key })),
    );
    await saveLayout(
      { venueId: venue.id, staffId: owner.staffId, role: "OWNER", permissions: ALL_PERMISSIONS },
      layout,
    );
    made++;
  }
  return made;
};

// Run as a script (not imported).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(`Laid out ${await seedLayouts()} venues.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    cache.disconnect();
    queueConnection.disconnect();
  }
}
