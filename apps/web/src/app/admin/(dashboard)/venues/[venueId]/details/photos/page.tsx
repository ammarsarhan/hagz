"use client";

import { MAXIMUM_VENUE_PHOTOS } from "@hagz/contracts";
import { IconPhoto } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Skeleton } from "@/admin/data-table";
import { PhotoViewer } from "@/admin/venues/photo-viewer";
import { useVenuePhotos } from "@/admin/venues/photos";

// A venue's photos, view only (user, 2026-11-17): the owner manages them in the staff app. A grid in
// the order players see them, the cover first and marked; a click opens one at full size.
export default function VenuePhotos() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error } = useVenuePhotos(venueId);
  // The photo open at full size.
  const [open, setOpen] = useState<number>();

  return (
    <section>
      <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">Photos</h2>
      <p className="mt-1 text-body text-ink-2">
        In the order players see them. The owner adds and arranges them in the staff app.
        {data ? ` ${String(data.length)} of ${String(MAXIMUM_VENUE_PHOTOS)}.` : ""}
      </p>

      <div className="mt-8">
        {error && !data ? (
          <p className="text-body text-ink-2">{error}</p>
        ) : !data ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-field" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center rounded-hud border border-dashed border-border px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-chip text-ink-2">
              <IconPhoto size={24} className="size-6" stroke={1.75} />
            </span>
            <p className="mt-4 text-body font-semibold text-ink">No photos yet</p>
            <p className="mt-1 text-label text-ink-2">They show here once the owner adds them.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {data.map((photo, index) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setOpen(index)}
                  aria-label={
                    index === 0 ? "Open the cover photo" : `Open photo ${String(index + 1)}`
                  }
                  className="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-field bg-chip"
                >
                  {/* Storage serves the app's already-resized JPEGs from its own host: next/image
                      would need that host configured and has nothing to add. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-opacity group-hover:opacity-90"
                  />
                  {index === 0 ? (
                    <span className="absolute top-2.5 left-2.5 rounded-full bg-white px-2.5 py-1 text-caption font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
                      Cover
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && open !== undefined ? (
        <PhotoViewer
          photos={data}
          index={open}
          onChange={setOpen}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
    </section>
  );
}
