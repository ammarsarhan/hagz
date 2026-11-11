"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Skeleton, Tag } from "@/admin/data-table";
import { LinkTabs } from "@/admin/tabs";
import { statusLabel } from "@/admin/venues/model";
import { venueHref, venueSections } from "@/admin/venues/sections";
import { useCurrentVenue, VenueProvider } from "@/admin/venues/venue";

// A venue's own dashboard, opened from the Venues table: a breadcrumb back, the venue's name and
// status, then its sections as tabs, each a page of its own. A placeholder structure until the
// user's layout for it arrives.
export default function VenueLayout({ children }: { children: ReactNode }) {
  const { venueId } = useParams<{ venueId: string }>();
  return (
    <VenueProvider venueId={venueId}>
      <VenueFrame venueId={venueId}>{children}</VenueFrame>
    </VenueProvider>
  );
}

function VenueFrame({ venueId, children }: { venueId: string; children: ReactNode }) {
  const { venue, missing, error } = useCurrentVenue();
  const pathname = usePathname();

  if (missing) {
    return (
      <>
        <Breadcrumb current="Not found" />
        <p className="mt-6 text-body text-ink-2">There’s no venue at this link.</p>
      </>
    );
  }

  const name = venue ? (venue.names.en ?? venue.names.ar ?? venue.slug) : undefined;

  return (
    <>
      <Breadcrumb current={name} />
      <header className="mt-4">
        {venue ? (
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-title font-semibold text-ink">{name}</h1>
            <Tag tone={venue.status === "LIVE" ? "on" : "neutral"}>{statusLabel[venue.status]}</Tag>
          </div>
        ) : error ? (
          <p className="text-body text-ink-2">{error}</p>
        ) : (
          <Skeleton className="h-8 w-64" />
        )}
        {venue?.area ? <p className="mt-1 text-body text-ink-2">{venue.area}</p> : null}
      </header>

      <div className="mt-6">
        <LinkTabs
          label="Venue sections"
          current={pathname}
          items={venueSections.map((section) => ({
            href: venueHref(venueId, section.slug),
            label: section.label,
          }))}
        />
      </div>

      <div className="mt-8">{children}</div>
    </>
  );
}

function Breadcrumb({ current }: { current?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-label">
      <Link href="/admin/venues" className="text-ink-2 hover:text-ink">
        Venues
      </Link>
      <span className="text-ink-3">/</span>
      {current ? (
        <span aria-current="page" className="truncate font-medium text-ink">
          {current}
        </span>
      ) : (
        <Skeleton className="h-3 w-24" />
      )}
    </nav>
  );
}
