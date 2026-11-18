"use client";

import type { AdminVenueAmenities, VenueLayoutView } from "@hagz/contracts";
import { IconArrowDown } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { amenityIcons } from "@/admin/platform/amenity-icons";
import type { AdminGround } from "./grounds";

// A venue's layout drawn to scale for its admin Grounds tab, read only: the staff app's layout (a
// cinema grid in ~10 m cells, the venue's outline, its grounds and amenities on it, entrances on
// its edges) in the admin's neutral inks: grey edges and the faintest grid, so the grounds are what
// reads. It fills its container and sits in its middle: cells are as big as fits both the width and
// the height, so the whole venue shows with no scrolling. Each ground is a button that opens its
// details; the open one turns white and glows (user, 2026-11-18).

// A paused ground's hatching, on the layout and in its legend: fading it alone barely shows against
// the light grey a ground is drawn in.
const HATCH = "repeating-linear-gradient(135deg, #dcdfe3 0 1px, transparent 1px 6px)";

// The space the view has to fill, kept up to date as the window changes.
function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
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
  const { ref, size } = useSize();
  // Whole pixels, so the grid's hairlines stay sharp; less the outline's 3px.
  const cell = Math.max(
    1,
    Math.floor(Math.min((size.width - 3) / layout.columns, (size.height - 3) / layout.rows)),
  );
  const byId = new Map(grounds.map((ground) => [ground.id, ground]));
  const amenityById = new Map((amenities ?? []).map((amenity) => [amenity.optionId, amenity]));

  const paused = grounds.some((ground) => ground.status === "MAINTENANCE");

  return (
    // The legend on its own row at the top left, so it never covers the venue; the drawing fills
    // what's left.
    <div className="flex size-full flex-col">
      <Legend
        paused={paused}
        amenities={layout.amenities.length > 0}
        entrances={layout.entrances.length > 0}
      />
      {/* Padded so the entrance tags, half over the edge, stay inside. */}
      <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center p-3">
        {size.width > 0 && size.height > 0 ? (
          <div
            role="group"
            aria-label="The venue's layout"
            className="relative rounded-[0.375rem] border-[1.5px] border-[#d5d8dd] bg-white"
            style={{
              width: layout.columns * cell + 3,
              height: layout.rows * cell + 3,
              // The grid: a hairline at every cell, barely there.
              backgroundImage:
                "linear-gradient(to right, #f4f5f7 1px, transparent 1px), linear-gradient(to bottom, #f4f5f7 1px, transparent 1px)",
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
              const paused = ground?.status === "MAINTENANCE";
              const on = tile.groundId === selected;
              return (
                <button
                  key={tile.groundId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelect(tile.groundId)}
                  // Grey at rest, a little whiter under the pointer; open, white and glowing, above
                  // its neighbours so the glow isn't covered.
                  className={`absolute flex cursor-pointer items-center justify-center overflow-hidden rounded-[0.25rem] border-[1.5px] transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    on
                      ? "z-10 border-[#c9cdd3] bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.85),0_0_28px_rgba(11,11,12,0.16)]"
                      : "border-[#d5d8dd] bg-chip hover:bg-[#f8f9fa]"
                  }`}
                  style={{
                    left: tile.x * cell,
                    top: tile.y * cell,
                    width: w,
                    height: h,
                    // Hatched while paused, unless it's open.
                    backgroundImage: paused && !on ? HATCH : undefined,
                  }}
                >
                  {/* The pitch's halfway line, across its length. */}
                  <span
                    aria-hidden
                    className={`absolute bg-[#d5d8dd] ${vertical ? "inset-x-0 top-1/2 h-px" : "inset-y-0 left-1/2 w-px"}`}
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
    </div>
  );
}

// What the drawing's marks are, each drawn as it is on the layout; paused grounds, amenities and
// entrances only when the venue has them.
function Legend({
  paused,
  amenities,
  entrances,
}: {
  paused: boolean;
  amenities: boolean;
  entrances: boolean;
}) {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-ink-2"
    >
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-3.5 border border-[#d5d8dd] bg-white"
          style={{
            backgroundImage:
              "linear-gradient(to right, #d5d8dd 1px, transparent 1px), linear-gradient(to bottom, #d5d8dd 1px, transparent 1px)",
            backgroundSize: "7px 7px",
            backgroundPosition: "-1px -1px",
          }}
        />
        1 square ≈ 10 m
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-3 w-5 rounded-[0.1875rem] border-[1.5px] border-[#d5d8dd] bg-chip"
        />
        Ground
      </li>
      {paused ? (
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-5 rounded-[0.1875rem] border-[1.5px] border-[#d5d8dd] bg-chip"
            style={{ backgroundImage: HATCH }}
          />
          Paused
        </li>
      ) : null}
      {amenities ? (
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3.5 rounded-[0.1875rem] border border-dashed border-[#c9cdd3] bg-[#fafafa]"
          />
          Amenity
        </li>
      ) : null}
      {entrances ? (
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-3.5 items-center justify-center rounded-full bg-ink text-white"
          >
            <IconArrowDown size={9} className="size-[0.5625rem]" stroke={2.5} />
          </span>
          Entrance
        </li>
      ) : null}
    </ul>
  );
}
