"use client";

import type { AdminVenueAmenities, VenueLayoutView } from "@hagz/contracts";
import { IconArrowDown } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { amenityIcons } from "@/admin/platform/amenity-icons";
import type { AdminGround } from "./grounds";

// A venue's layout drawn to scale for its admin Grounds tab, read only: the staff app's layout (a
// cinema grid in ~10 m cells, the venue's outline, its grounds and amenities on it, entrances on
// its edges) in the admin's neutral inks. Each ground is a button that opens its details; the one
// open is drawn in ink. Cells shrink so the whole venue fits the column, and never grow past 32px.

const MAX_CELL = 32;
// Small enough that the widest venue (60 cells) fits half a page.
const MIN_CELL = 6;

// The width the view has to fit in, kept up to date as the window changes.
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function LayoutView({
  layout,
  grounds,
  amenities,
  selected,
  onSelect,
}: {
  layout: VenueLayoutView;
  grounds: AdminGround[];
  amenities?: AdminVenueAmenities["amenities"];
  selected?: string;
  onSelect: (groundId: string) => void;
}) {
  const { ref, width } = useWidth();
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(width / layout.columns)));
  const byId = new Map(grounds.map((ground) => [ground.id, ground]));
  const amenityById = new Map((amenities ?? []).map((amenity) => [amenity.optionId, amenity]));

  return (
    // Padded so the entrance tags, half over the edge, aren't cut off by the scroll.
    <div ref={ref} className="w-full overflow-x-auto p-3">
      {width > 0 ? (
        <div
          role="group"
          aria-label="The venue's layout"
          className="relative rounded-[0.375rem] border-[1.5px] border-ink bg-white"
          style={{
            width: layout.columns * cell + 3,
            height: layout.rows * cell + 3,
            // The grid: a hairline at every cell.
            backgroundImage:
              "linear-gradient(to right, #eef0f2 1px, transparent 1px), linear-gradient(to bottom, #eef0f2 1px, transparent 1px)",
            backgroundSize: `${String(cell)}px ${String(cell)}px`,
          }}
        >
          {layout.amenities.map((tile, index) => {
            const amenity = amenityById.get(tile.optionId);
            const Drawn = amenity ? amenityIcons[amenity.icon].icon : null;
            const name = amenity?.names.en ?? amenity?.key ?? "Amenity";
            return (
              <div
                key={`${tile.optionId}-${String(index)}`}
                title={name}
                className="absolute flex items-center justify-center rounded-[0.25rem] border border-dashed border-[#c9cdd3] bg-[#fafafa] text-ink-2"
                style={{
                  left: tile.x * cell,
                  top: tile.y * cell,
                  width: tile.width * cell,
                  height: tile.height * cell,
                }}
              >
                {Drawn ? (
                  <Drawn size={16} className="size-4" stroke={1.75} aria-label={name} />
                ) : null}
              </div>
            );
          })}

          {layout.grounds.map((tile) => {
            const ground = byId.get(tile.groundId);
            // Stored as if horizontal: a vertical ground swaps its length and breadth.
            const vertical = tile.orientation === "VERTICAL";
            const w = (vertical ? tile.height : tile.width) * cell;
            const h = (vertical ? tile.width : tile.height) * cell;
            const on = tile.groundId === selected;
            const paused = ground?.status === "MAINTENANCE";
            return (
              <button
                key={tile.groundId}
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(tile.groundId)}
                className={`absolute flex cursor-pointer items-center justify-center overflow-hidden rounded-[0.25rem] border-[1.5px] transition-colors ${
                  on
                    ? "border-ink bg-[#e3e5e9]"
                    : "border-[#9aa0a8] bg-chip hover:border-ink hover:bg-[#e9ebee]"
                } ${paused ? "opacity-60" : ""}`}
                style={{ left: tile.x * cell, top: tile.y * cell, width: w, height: h }}
              >
                {/* The pitch's halfway line, across its length. */}
                <span
                  aria-hidden
                  className={`absolute bg-[#c9cdd3] ${vertical ? "inset-x-0 top-1/2 h-px" : "inset-y-0 left-1/2 w-px"}`}
                />
                <span className="relative max-w-full truncate px-1.5 text-caption font-medium text-ink">
                  {ground?.name ?? "Ground"}
                </span>
              </button>
            );
          })}

          {layout.entrances.map((entrance, index) => {
            const horizontal = entrance.side === "TOP" || entrance.side === "BOTTOM";
            const along = entrance.offset * cell + cell / 2;
            const position = horizontal
              ? { left: along, [entrance.side === "TOP" ? "top" : "bottom"]: -10 }
              : { top: along, [entrance.side === "LEFT" ? "left" : "right"]: -10 };
            // Pointing in, from whichever edge it's on.
            const rotate = { TOP: 0, RIGHT: 90, BOTTOM: 180, LEFT: 270 }[entrance.side];
            return (
              <span
                key={`${entrance.side}-${String(index)}`}
                title="Entrance"
                className="absolute flex size-5 items-center justify-center rounded-full bg-ink text-white"
                style={{
                  ...position,
                  // Centred on its cell along the edge.
                  transform: horizontal ? "translateX(-50%)" : "translateY(-50%)",
                }}
              >
                <IconArrowDown
                  size={12}
                  className="size-3"
                  stroke={2.25}
                  style={{ transform: `rotate(${String(rotate)}deg)` }}
                  aria-label="Entrance"
                />
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
