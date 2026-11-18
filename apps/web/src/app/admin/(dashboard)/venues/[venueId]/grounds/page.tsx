"use client";

import { useParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Skeleton } from "@/admin/data-table";
import { useVenueAmenities } from "@/admin/venues/amenities";
import { GroundModal } from "@/admin/venues/ground-modal";
import { useVenueGrounds } from "@/admin/venues/grounds";
import { LayoutView } from "@/admin/venues/layout-view";

// A venue's Grounds tab: for now only its layout, drawn to scale and filling the space under the
// tabs (user, 2026-11-18), each ground on it opening its details in a modal. The grounds list comes
// later. A venue with one ground needs no layout, so it says so instead.
export default function VenueGrounds() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error } = useVenueGrounds(venueId);
  // The layout's amenity tiles show their icons and names.
  const { data: amenities } = useVenueAmenities(venueId);
  const drawn = data?.layout.saved && data.layout.grounds.length > 0;
  const [selected, setSelected] = useState<string>();
  const ground = data?.grounds.find((g) => g.id === selected);

  // Exactly the window below the tabs, less the page's 64px bottom padding (main's pb-16), so the
  // page never scrolls: measured from where the section starts, again on every resize.
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const fit = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      setHeight(Math.max(320, window.innerHeight - top - 64));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <section
      ref={ref}
      className="flex w-full items-center justify-center"
      style={{ height: height ?? 320 }}
    >
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
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </section>
  );
}
