"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/admin/button";
import { SkeletonText } from "@/admin/data-table";
import { Flag } from "@/admin/flag";
import { formatCenter, mapsLink } from "@/admin/platform/geo";
import { AreaDialog } from "@/admin/venues/area-dialog";
import { useVenueLocation } from "@/admin/venues/location";
import { DetailsBlock, DetailsRow } from "@/admin/venues/details-block";
import { useCurrentVenue } from "@/admin/venues/venue";

// Where a venue is, laid out like Translations: the area players find it under (or the one its owner
// asked for, which approval waits on), then the owner's pin with a link to Google Maps. The pin is
// the owner's to move in the staff app; an admin sets the area (user, 2026-11-17).
export default function VenueLocation() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue, reload: reloadVenue } = useCurrentVenue();
  const { data, error, reload } = useVenueLocation(venueId);
  const [editing, setEditing] = useState(false);

  return (
    <section>
      <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">Location</h2>
      <p className="mt-1 text-body text-ink-2">
        The area players find the venue under, and the owner’s pin. The owner moves the pin in the
        staff app.
      </p>

      {error && !data ? (
        <p className="mt-8 text-body text-ink-2">{error}</p>
      ) : (
        <>
          <DetailsBlock
            title="Area"
            action={
              data && venue ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="shrink-0 cursor-pointer text-label font-semibold text-ink underline underline-offset-4 hover:opacity-70"
                >
                  {data.area ? "Edit" : "Set area"}
                </button>
              ) : null
            }
          >
            {/* The country the venue is in: its areas, currency and tax come from it, and it can't
                change (an area is always picked in the same one). */}
            <DetailsRow label="Marketplace">
              {data ? (
                <span className="flex items-center gap-2.5">
                  <Flag code={data.marketplace.code} size="1.25rem" />
                  <span className="text-body text-ink">
                    {data.marketplace.names.en ?? data.marketplace.code}
                  </span>
                </span>
              ) : (
                <SkeletonText size="body" className="w-32" />
              )}
            </DetailsRow>
            {data?.requestedArea ? (
              <DetailsRow label="Asked for">
                <p className="text-body text-ink">{data.requestedArea}</p>
                <p className="mt-0.5 text-label text-ink-2">
                  Hagz doesn’t cover it yet. Approval waits until an area is set.
                </p>
              </DetailsRow>
            ) : null}
            <DetailsRow label="English">
              <Value loading={!data} text={data?.area?.names.en} />
            </DetailsRow>
            <DetailsRow label="Arabic">
              <Value loading={!data} text={data?.area?.names.ar} arabic />
            </DetailsRow>
          </DetailsBlock>

          <DetailsBlock title="Pin">
            <DetailsRow label="Coordinates" center={Boolean(data?.coordinates)}>
              {!data ? (
                <SkeletonText size="body" className="w-40" />
              ) : data.coordinates ? (
                <div className="flex items-center justify-between gap-6">
                  <span className="text-body text-ink tabular-nums">
                    {formatCenter(data.coordinates)}
                  </span>
                  <ButtonLink
                    href={mapsLink(data.coordinates)}
                    target="_blank"
                    rel="noreferrer"
                    variant="secondary"
                    size="small"
                    weight="medium"
                  >
                    Open in Google Maps
                    <IconExternalLink size={16} className="size-4" stroke={1.75} aria-hidden />
                  </ButtonLink>
                </div>
              ) : (
                <span className="text-body text-ink-3">The owner hasn’t dropped one yet.</span>
              )}
            </DetailsRow>
          </DetailsBlock>
        </>
      )}

      {editing && data && venue ? (
        <AreaDialog
          venueId={venueId}
          marketplaceId={venue.marketplace.id}
          location={data}
          onClose={() => setEditing(false)}
          onDone={() => {
            reload();
            // The header shows the area.
            reloadVenue();
          }}
        />
      ) : null}
    </section>
  );
}

function Value({
  loading,
  text,
  arabic = false,
}: {
  loading: boolean;
  text?: string | null;
  arabic?: boolean;
}) {
  if (loading) return <SkeletonText size="body" className={`w-48 ${arabic ? "ml-auto" : ""}`} />;
  return text ? (
    <p
      dir={arabic ? "rtl" : undefined}
      lang={arabic ? "ar" : undefined}
      className="text-body text-ink"
    >
      {text}
    </p>
  ) : (
    <p className={`text-body text-ink-3 ${arabic ? "text-right" : ""}`}>None</p>
  );
}
