"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Skeleton, Tag } from "@/admin/data-table";
import { formatMoney } from "@/admin/money";
import { useVenueAmenities } from "@/admin/venues/amenities";
import { DetailsBlock } from "@/admin/venues/details-block";
import { GroundPanel } from "@/admin/venues/ground-panel";
import { sizeLabel, sportLabel, useVenueGrounds } from "@/admin/venues/grounds";
import { LayoutView } from "@/admin/venues/layout-view";

// A venue's Grounds tab: its layout drawn to scale (user, 2026-11-18), each ground on it a button
// that opens its details in a side panel, and every ground listed under it, so one not on the
// layout (or a venue with one ground, which needs no layout) is still reachable.
export default function VenueGrounds() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error } = useVenueGrounds(venueId);
  // The layout's amenity tiles show their icons and names.
  const { data: amenities } = useVenueAmenities(venueId);
  const [selected, setSelected] = useState<string>();
  const ground = data?.grounds.find((g) => g.id === selected);
  const placed = new Set(data?.layout.grounds.map((tile) => tile.groundId));

  return (
    // The first block sits right under the tabs, like the other tabs' content.
    <section className="[&>*:first-child]:mt-0">
      {error && !data ? (
        <p className="text-body text-ink-2">{error}</p>
      ) : !data ? (
        <Skeleton className="h-72 w-full rounded-card" />
      ) : (
        // Side by side, half each, on a wide window; stacked, the layout first, on a narrow one. The
        // columns can shrink below their content (minmax 0), so the layout scales down to fit.
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-12 [&>*]:mt-0">
          {data.layout.saved && data.layout.grounds.length > 0 ? (
            <DetailsBlock title="Layout">
              <div className="pt-4">
                <LayoutView
                  layout={data.layout}
                  grounds={data.grounds}
                  amenities={amenities?.amenities}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
            </DetailsBlock>
          ) : null}

          <DetailsBlock title={`All grounds · ${String(data.grounds.length)}`}>
            {data.grounds.length === 0 ? (
              <p className="py-4 text-body text-ink-3">No grounds yet.</p>
            ) : (
              <ul>
                {data.grounds.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(g.id)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-6 border-b border-border px-1 py-3.5 text-left transition-colors hover:bg-[#fafafa] ${
                        g.id === selected ? "bg-[#f5f5f5]" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-body font-medium text-ink">
                            {g.name ?? "Ground"}
                          </span>
                          {g.status === "MAINTENANCE" ? <Tag>Paused</Tag> : null}
                          {data.layout.saved && !placed.has(g.id) ? (
                            <Tag>Not on the layout</Tag>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-label text-ink-2">
                          {sportLabel[g.sport]} · {sizeLabel[g.size]}
                        </span>
                      </span>
                      <span className="shrink-0 text-label text-ink tabular-nums">
                        {formatMoney(data.currency, g.basePrice)}/hr
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DetailsBlock>
        </div>
      )}

      {data && ground ? (
        <GroundPanel
          key={ground.id}
          ground={ground}
          currency={data.currency}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </section>
  );
}
