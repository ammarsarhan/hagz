"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Skeleton } from "@/admin/data-table";
import { formatCenter, mapsLink } from "@/admin/platform/geo";
import { AreaPanel } from "@/admin/venues/area-panel";
import { useVenueLocation } from "@/admin/venues/location";
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
          <Block
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
            {data?.requestedArea ? (
              <Row label="Asked for">
                <p className="text-body text-ink">{data.requestedArea}</p>
                <p className="mt-0.5 text-label text-ink-2">
                  Hagz doesn’t cover it yet. Approval waits until an area is set.
                </p>
              </Row>
            ) : null}
            <Row label="English">
              <Value loading={!data} text={data?.area?.names.en} />
            </Row>
            <Row label="Arabic">
              <Value loading={!data} text={data?.area?.names.ar} arabic />
            </Row>
          </Block>

          <Block title="Pin">
            <Row label="Coordinates">
              {!data ? (
                <Skeleton className="h-4 w-40" />
              ) : data.coordinates ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-body text-ink tabular-nums">
                    {formatCenter(data.coordinates)}
                  </span>
                  <a
                    href={mapsLink(data.coordinates)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-label font-medium text-ink-2 hover:text-ink hover:underline"
                  >
                    Open in Google Maps
                    <IconExternalLink size={14} className="size-3.5" stroke={2} aria-hidden />
                  </a>
                </div>
              ) : (
                <span className="text-body text-ink-3">The owner hasn’t dropped one yet.</span>
              )}
            </Row>
          </Block>
        </>
      )}

      {editing && data && venue ? (
        <AreaPanel
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

function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-6 border-b border-border pb-3">
        <h3 className="text-body font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-x-6 border-b border-border py-4">
      <span className="text-label text-ink-2">{label}</span>
      <div>{children}</div>
    </div>
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
  if (loading) return <Skeleton className={`h-4 w-48 ${arabic ? "ml-auto" : ""}`} />;
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
