"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@/admin/data-table";
import { useVenueAmenities } from "@/admin/venues/amenities";
import { useVenueGrounds } from "@/admin/venues/grounds";
import { LayoutView } from "@/admin/venues/layout-view";

// A venue's Grounds tab: for now only its layout, drawn to scale and filling the space under the
// tabs (user, 2026-11-18). The grounds list and a ground's details come later. A venue with one
// ground needs no layout, so it says so instead.
export default function VenueGrounds() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error } = useVenueGrounds(venueId);
  // The layout's amenity tiles show their icons and names.
  const { data: amenities } = useVenueAmenities(venueId);
  const drawn = data?.layout.saved && data.layout.grounds.length > 0;

  return (
    // The window's height less the header, breadcrumb and tabs above, never under 20rem.
    <section className="flex h-[calc(100dvh-15rem)] min-h-80 w-full items-center justify-center">
      {error && !data ? (
        <p className="text-body text-ink-2">{error}</p>
      ) : !data ? (
        <Skeleton className="size-full rounded-card" />
      ) : drawn ? (
        <LayoutView layout={data.layout} grounds={data.grounds} amenities={amenities?.amenities} />
      ) : (
        <p className="text-body text-ink-3">
          {data.grounds.length === 0 ? "No grounds yet." : "No layout yet."}
        </p>
      )}
    </section>
  );
}
