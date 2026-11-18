"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/admin/api";
import { Skeleton } from "@/admin/data-table";
import { message, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";
import { useVenueAmenities } from "@/admin/venues/amenities";
import { GroundModal } from "@/admin/venues/ground-modal";
import { useVenueGrounds } from "@/admin/venues/grounds";
import { LayoutView } from "@/admin/venues/layout-view";
import { venueHref } from "@/admin/venues/sections";
import { useFillHeight } from "@/admin/venues/use-fill-height";

// A venue's Grounds tab: for now only its layout, drawn to scale and filling the space under the
// tabs (user, 2026-11-18), each ground on it opening its details in a modal. The grounds list comes
// later. A venue with one ground needs no layout, so it says so instead.
export default function VenueGrounds() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error, reload } = useVenueGrounds(venueId);
  const hud = useHud();
  // Queues a run, gives it a moment (one ground takes well under a second), then reads its status
  // again.
  const regenerate = async (groundId: string) => {
    const result = await send(
      api.POST("/v1/admin/venues/{id}/grounds/{groundId}/regenerate", {
        params: { path: { id: venueId, groundId } },
      }),
    );
    if (!result.ok) {
      hud(message(result.error));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await reload();
  };
  // The layout's amenity tiles show their icons and names.
  const { data: amenities } = useVenueAmenities(venueId);
  const drawn = data?.layout.saved && data.layout.grounds.length > 0;
  const [selected, setSelected] = useState<string>();
  const ground = data?.grounds.find((g) => g.id === selected);

  // Exactly the window below the tabs, so the page never scrolls.
  const { ref, height } = useFillHeight();

  return (
    <section ref={ref} className="flex w-full items-center justify-center" style={{ height }}>
      {error && !data ? (
        <p className="text-body text-ink-2">{error}</p>
      ) : !data ? (
        <Skeleton className="size-full rounded-card" />
      ) : drawn ? (
        <LayoutView
          layout={data.layout}
          grounds={data.grounds}
          amenities={amenities?.amenities}
          selected={selected}
          onSelect={setSelected}
        />
      ) : (
        <p className="text-body text-ink-3">
          {data.grounds.length === 0 ? "No grounds yet." : "No layout yet."}
        </p>
      )}

      {data && ground ? (
        <GroundModal
          ground={ground}
          tile={data.layout.grounds.find((tile) => tile.groundId === ground.id)}
          currency={data.currency}
          slotsHref={venueHref(venueId, "slots")}
          onRegenerate={() => regenerate(ground.id)}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </section>
  );
}
