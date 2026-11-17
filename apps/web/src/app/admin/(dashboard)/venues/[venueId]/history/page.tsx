"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/admin/button";
import { DataTable, Tag } from "@/admin/data-table";
import {
  dateTime,
  eventLabel,
  useVenueHistory,
  type VenueHistoryEvent,
} from "@/admin/venues/history";
import { HistoryEventModal } from "@/admin/venues/history-event";

// A venue's History tab: everything that happened to it, newest first, in the admin's one table
// design. A page at a time from the API; Show more below the table fetches the next. Clicking a row
// opens the event in full: who did it, with their id, and its payload.

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, VenueHistoryEvent>();

// Who did it. Staff by name; an admin by name with a tag, so the review's steps stand out; the system
// (jobs, sweeps) as a System tag. A name is missing when the account is gone.
function Actor({ actor }: { actor: VenueHistoryEvent["actor"] }) {
  if (actor.kind === "SYSTEM") return <Tag tone="neutral">System</Tag>;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {actor.name ? (
        <span className="truncate text-ink-2">{actor.name}</span>
      ) : (
        <span className="text-ink-3">Unknown</span>
      )}
      {actor.kind === "ADMIN" ? <Tag tone="neutral">Admin</Tag> : null}
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
    id: "event",
    header: "Event",
    cell: ({ row }) => <span className="truncate text-ink">{eventLabel(row.original.type)}</span>,
  }),
  helper.display({
    id: "actor",
    header: "By",
    cell: ({ row }) => <Actor actor={row.original.actor} />,
  }),
  helper.display({
    id: "when",
    header: "When",
    cell: ({ row }) => (
      <span className="text-ink-2 tabular-nums">{dateTime(row.original.createdAt)}</span>
    ),
  }),
]);

// Event takes what's left.
const widths = { index: "3.5rem", actor: "28%", when: "12rem" };

export default function VenueHistory() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error, loadingMore, loadMore } = useVenueHistory(venueId);
  // The event whose details are open, from a click on its row.
  const [opened, setOpened] = useState<VenueHistoryEvent>();

  const table = useTable({
    features,
    columns,
    data: data?.events ?? [],
    getRowId: (event) => event.id,
  });

  return (
    <>
      <DataTable
        table={table}
        widths={widths}
        onRowClick={(row) => setOpened(row.original)}
        loading={!data && !error}
        empty={error ?? "Nothing has happened to this venue yet."}
      />
      {data?.next ? (
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
      {opened ? <HistoryEventModal event={opened} onClose={() => setOpened(undefined)} /> : null}
    </>
  );
}
