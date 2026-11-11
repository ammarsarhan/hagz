"use client";

import type { AdminVenue, VenueStatus } from "@hagz/contracts";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useState } from "react";
import { day } from "@/admin/admins/model";
import { Button } from "@/admin/button";
import { Count, DataTable, TableSearch, Tag } from "@/admin/data-table";
import { Flag } from "@/admin/flag";
import { PageHeader } from "@/admin/page-header";
import { TabPanel, Tabs } from "@/admin/tabs";
import { STATUSES, statusLabel, useVenues } from "@/admin/venues/model";

// Every venue, in any status, in the admin's one table design. Tabs filter by status (Submitted is
// the review queue) and the search goes to the API, which sends a page at a time: Show more below
// the table fetches the next. Opening a venue's own dashboard comes next.

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AdminVenue>();

function VenueName({ venue }: { venue: AdminVenue }) {
  const { en, ar } = venue.names;
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="truncate text-ink">{en ?? ar ?? venue.slug}</span>
      {/* The Arabic name beside the English, when both exist. */}
      {en && ar ? (
        <span dir="rtl" className="truncate text-caption text-ink-3">
          {ar}
        </span>
      ) : null}
    </div>
  );
}

const columns = helper.columns([
  helper.display({
    id: "index",
    header: "#",
    cell: ({ row }) => <span className="text-ink-3 tabular-nums">{row.index + 1}</span>,
  }),
  helper.display({
    id: "name",
    header: "Name",
    cell: ({ row }) => <VenueName venue={row.original} />,
  }),
  helper.display({
    id: "area",
    header: "Area",
    cell: ({ row }) =>
      row.original.area ? (
        <span className="truncate text-ink-2">{row.original.area}</span>
      ) : (
        <span className="text-ink-3">None</span>
      ),
  }),
  helper.display({
    id: "owner",
    header: "Owner",
    cell: ({ row }) =>
      row.original.owner ? (
        <span className="truncate text-ink-2">{row.original.owner.name}</span>
      ) : (
        <span className="text-ink-3">None</span>
      ),
  }),
  helper.display({
    id: "marketplace",
    header: "Marketplace",
    cell: ({ row }) => (
      // The flag alone; the code is there for screen readers and on hover.
      <span title={row.original.marketplace.code} className="flex">
        <Flag code={row.original.marketplace.code} size="1.25rem" />
        <span className="sr-only">{row.original.marketplace.code}</span>
      </span>
    ),
  }),
  helper.display({
    id: "grounds",
    header: "Grounds",
    cell: ({ row }) => <Count value={row.original.groundCount} />,
  }),
  helper.display({
    id: "created",
    header: "Created",
    cell: ({ row }) => <span className="text-ink-2">{day(row.original.createdAt)}</span>,
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Tag tone={row.original.status === "LIVE" ? "on" : "neutral"}>
        {statusLabel[row.original.status]}
      </Tag>
    ),
  }),
]);

// Name takes what's left, so it gets the most room.
const widths = {
  index: "3.5rem",
  area: "16%",
  owner: "14%",
  marketplace: "7rem",
  grounds: "6rem",
  created: "8rem",
  status: "8rem",
};

type Section = "ALL" | VenueStatus;

export default function AdminVenues() {
  const [section, setSection] = useState<Section>("ALL");
  const [query, setQuery] = useState("");
  const status = section === "ALL" ? undefined : section;
  const { data, error, loadingMore, loadMore } = useVenues(status, query);

  const table = useTable({
    features,
    columns,
    data: data?.venues ?? [],
    getRowId: (venue) => venue.id,
  });

  const counts = data?.counts;
  const total = counts ? STATUSES.reduce((sum, s) => sum + counts[s], 0) : undefined;
  const searching = query.trim() !== "";

  return (
    <>
      <PageHeader title="Venues" subtitle="Every venue, from drafts to live." />

      <div className="mt-6">
        <Tabs
          label="Statuses"
          value={section}
          onChange={setSection}
          items={[
            { id: "ALL", label: "All", count: total },
            ...STATUSES.map((s) => ({ id: s, label: statusLabel[s], count: counts?.[s] })),
          ]}
        />
      </div>

      <TabPanel id={section}>
        <div className="mt-6">
          <TableSearch value={query} onChange={setQuery} placeholder="Search venues…" />
        </div>
        <div className="mt-4">
          <DataTable
            table={table}
            widths={widths}
            loading={!data && !error}
            empty={
              error ??
              (searching
                ? `No venue matches “${query.trim()}”.`
                : status
                  ? `No ${statusLabel[status].toLowerCase()} venues.`
                  : "No venues yet.")
            }
          />
        </div>
        {data?.nextCursor ? (
          <div className="mt-6 flex justify-center">
            <Button
              size="small"
              variant="secondary"
              loading={loadingMore}
              onClick={() => void loadMore()}
            >
              Show more
            </Button>
          </div>
        ) : null}
      </TabPanel>
    </>
  );
}
