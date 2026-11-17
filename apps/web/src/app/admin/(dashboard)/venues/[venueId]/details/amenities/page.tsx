"use client";

import { IconStar } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/admin/data-table";
import { amenityIcons } from "@/admin/platform/amenity-icons";
import { formatAmenityPrice, useVenueAmenities } from "@/admin/venues/amenities";

// What a venue offers, view only like its photos: the owner picks amenities and their prices in the
// staff app. One row each, its icon and name, the Arabic name players see, whether it's drawn on the
// venue's layout, and the price.

const GRID = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_9rem] items-center gap-x-6";

export default function VenueAmenities() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error } = useVenueAmenities(venueId);
  const count = data?.amenities.length;

  return (
    <section>
      <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">Amenities</h2>
      <p className="mt-1 text-body text-ink-2">
        What the venue offers, and what each costs when it isn’t free.
        {count ? ` ${String(count)} ${count === 1 ? "amenity" : "amenities"}.` : ""}
      </p>

      {error && !data ? (
        <p className="mt-8 text-body text-ink-2">{error}</p>
      ) : data && data.amenities.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-hud border border-dashed border-border px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-chip text-ink-2">
            <IconStar size={24} className="size-6" stroke={1.75} />
          </span>
          <p className="mt-4 text-body font-semibold text-ink">No amenities yet</p>
          <p className="mt-1 text-label text-ink-2">They show here once the owner picks them.</p>
        </div>
      ) : (
        <div className="mt-8">
          <div className={`${GRID} border-b border-border pb-3 text-label font-semibold text-ink`}>
            <span>Amenity</span>
            <span className="text-right">Arabic</span>
            <span>In layout</span>
            <span className="text-right">Price</span>
          </div>
          {!data
            ? [0, 1, 2].map((i) => (
                <div key={i} className={`${GRID} border-b border-border py-4`}>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="ml-auto h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="ml-auto h-4 w-20" />
                </div>
              ))
            : data.amenities.map((amenity) => {
                const { icon: Drawn } = amenityIcons[amenity.icon];
                return (
                  <div key={amenity.optionId} className={`${GRID} border-b border-border py-4`}>
                    <span className="flex min-w-0 items-center gap-3">
                      <Drawn
                        size={20}
                        className="size-5 shrink-0 text-ink-2"
                        stroke={1.75}
                        aria-hidden
                      />
                      <span className="truncate text-body text-ink">
                        {amenity.names.en ?? amenity.key}
                      </span>
                      {/* Hagz turned the option off: no venue can newly pick it, this one keeps it. */}
                      {amenity.isActive ? null : (
                        <span className="shrink-0 text-label text-ink-3">Turned off by Hagz</span>
                      )}
                    </span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className={`truncate text-body ${amenity.names.ar ? "text-ink-2" : "text-ink-3"}`}
                    >
                      {amenity.names.ar ?? "None"}
                    </span>
                    <InLayout placeable={amenity.placeable} tiles={amenity.tiles} />
                    <span className="text-right text-body text-ink tabular-nums">
                      {formatAmenityPrice(data.currency, amenity.price, amenity.pricing)}
                    </span>
                  </div>
                );
              })}
        </div>
      )}
    </section>
  );
}

// "Yes", "Yes, 2 times" when it's drawn more than once, "No", or "Can't be placed" for an option
// that never goes on a layout (Wi-Fi, a ball to rent).
function InLayout({ placeable, tiles }: { placeable: boolean; tiles: number }) {
  if (!placeable) return <span className="text-label text-ink-3">Can’t be placed</span>;
  if (tiles === 0) return <span className="text-body text-ink-2">No</span>;
  return (
    <span className="text-body text-ink">
      Yes{tiles > 1 ? <span className="text-ink-2">, {tiles} times</span> : null}
    </span>
  );
}
