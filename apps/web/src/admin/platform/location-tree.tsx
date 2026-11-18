"use client";

import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { LocationNode } from "./model";

// A marketplace's locations as a tree table, shared by its Locations tab and the venue area picker
// (admin/venues/area-dialog.tsx), so the two look and search the same.

// What the name cell needs from a TanStack row with row expanding.
interface TreeRow {
  original: LocationNode;
  depth: number;
  getCanExpand: () => boolean;
  getIsExpanded: () => boolean;
  getToggleExpandedHandler: () => () => void;
}

// The name, indented by depth, after a chevron that opens and closes what's under it.
export function LocationName({ row, trailing }: { row: TreeRow; trailing?: ReactNode }) {
  const { location } = row.original;
  const open = row.getIsExpanded();
  return (
    <div className="flex items-center gap-1.5" style={{ paddingLeft: `${row.depth * 1.5}rem` }}>
      {row.getCanExpand() ? (
        <button
          type="button"
          onClick={(event) => {
            // Only the chevron: a row that does something on click doesn't also do it.
            event.stopPropagation();
            row.getToggleExpandedHandler()();
          }}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${location.names.en}`}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[0.375rem] text-ink-2 hover:bg-chip hover:text-ink"
        >
          {open ? (
            <IconChevronDown size={16} className="size-4" stroke={1.75} />
          ) : (
            <IconChevronRight size={16} className="size-4" stroke={1.75} />
          )}
        </button>
      ) : (
        <span className="size-6 shrink-0" />
      )}
      <span className="truncate text-ink">{location.names.en}</span>
      {trailing}
    </div>
  );
}

// The tree cut down to what matches the English or Arabic name, with the parents of
// every match kept so it shows where it sits. A match keeps everything under it.
export const searchLocations = (nodes: LocationNode[], query: string): LocationNode[] => {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.flatMap((node) => {
    const { names } = node.location;
    if ([names.en, names.ar].some((text) => text.toLowerCase().includes(q))) return [node];
    const children = searchLocations(node.children, query);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
};
