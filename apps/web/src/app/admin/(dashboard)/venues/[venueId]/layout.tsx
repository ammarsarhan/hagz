"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton, Tag } from "@/admin/data-table";
import { LinkTabs } from "@/admin/tabs";
import { statusLabel } from "@/admin/venues/model";
import { defaultSlug, venueHref, visibleSections } from "@/admin/venues/sections";
import { useCurrentVenue, VenueProvider } from "@/admin/venues/venue";

// A venue's own dashboard, opened from the Venues table: a breadcrumb back, the venue's name and
// status, then its sections as tabs, each a page of its own. The layout the user chose (2026-11-11),
// under the main rail. Its tabs depend on its status (admin/venues/sections.ts): the venue's own
// link, or a tab it doesn't have (an old link to its application once it's live), goes to the tab it
// opens on.
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
  const router = useRouter();

  const sections = venue ? visibleSections(venue.status) : [];
  const slug = pathname.slice(venueHref(venueId).length + 1).split("/")[0] ?? "";
  const shown = sections.some((section) => section.slug === slug);
  const target = venue ? venueHref(venueId, defaultSlug(venue.status)) : undefined;

  useEffect(() => {
    if (target && !shown) router.replace(target);
  }, [target, shown, router]);

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
        {venue ? (
          <LinkTabs
            label="Venue sections"
            current={pathname}
            items={sections.map((section) => ({
              href: venueHref(venueId, section.slug),
              label: section.label,
            }))}
          />
        ) : (
          <Skeleton className="h-8 w-96" />
        )}
      </div>

      {shown ? <div className="mt-8">{children}</div> : null}
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
