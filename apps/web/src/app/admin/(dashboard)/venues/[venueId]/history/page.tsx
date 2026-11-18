"use client";

import {
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
  type ExpandedState,
  type Row,
} from "@tanstack/react-table";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/admin/button";
import { DataTable, Tag } from "@/admin/data-table";
import {
  dateTime,
  eventLabel,
  historyRows,
  useVenueHistory,
  type HistoryRow,
  type VenueHistoryEvent,
} from "@/admin/venues/history";
import { HistoryEventModal } from "@/admin/venues/history-event";

// A venue's History tab: everything that happened to it, newest first, in the admin's one table
// design. A page at a time from the API; Show more below the table fetches the next. The same event
// back to back is one row with a count, which opens like a location's sublocations to show each.
// Clicking an event opens it in full: who did it, with their id, and its payload.

const features = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});
type HistoryTableRow = Row<typeof features, HistoryRow>;
const helper = createColumnHelper<typeof features, HistoryRow>();

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

// A run's events, one person or several. Same person: by their kind and id, since names can repeat.
function RunActors({ events }: { events: VenueHistoryEvent[] }) {
  const people = new Set(events.map(({ actor }) => `${actor.kind}:${actor.id ?? ""}`));
  const [first] = events;
  if (people.size === 1 && first) return <Actor actor={first.actor} />;
  return <span className="text-ink-2">{people.size} people</span>;
}

// The event's name, under its run's when it's one of a run's events. A run's chevron opens it like
// a location's sublocations; the row does the same, so the click stops here.
function EventName({ row }: { row: HistoryTableRow }) {
  const item = row.original;
  const label = eventLabel(item.kind === "run" ? item.type : item.event.type);
  const open = row.getIsExpanded();
  return (
    <div className="flex items-center gap-1.5" style={{ paddingLeft: `${row.depth * 1.5}rem` }}>
      {item.kind === "run" ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            row.toggleExpanded();
          }}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[0.375rem] text-ink-2 hover:bg-chip hover:text-ink"
        >
          {open ? (
            <IconChevronDown size={16} className="size-4" stroke={1.75} />
          ) : (
            <IconChevronRight size={16} className="size-4" stroke={1.75} />
          )}
        </button>
      ) : (
        <span className="size-6 shrink-0" />
      )}
      <span className="truncate text-ink">{label}</span>
      {item.kind === "run" ? <Tag>{item.events.length}</Tag> : null}
    </div>
  );
}

const columns = helper.columns([
  helper.display({
    id: "index",
    header: "#",
    // Top-level rows only: a run's events sit under its number.
    cell: ({ row }) =>
      row.depth === 0 ? <span className="text-ink-3 tabular-nums">{row.index + 1}</span> : null,
  }),
  helper.display({
    id: "event",
    header: "Event",
    cell: ({ row }) => <EventName row={row} />,
  }),
  helper.display({
    id: "actor",
    header: "By",
    cell: ({ row }) =>
      row.original.kind === "run" ? (
        <RunActors events={row.original.events} />
      ) : (
        <Actor actor={row.original.event.actor} />
      ),
  }),
  helper.display({
    id: "when",
    header: "When",
    // A run: its newest event's time, the one it's listed by.
    cell: ({ row }) => {
      const item = row.original;
      const at = item.kind === "run" ? item.events[0]?.createdAt : item.event.createdAt;
      return <span className="text-ink-2 tabular-nums">{at ? dateTime(at) : null}</span>;
    },
  }),
]);

// Event takes what's left.
const widths = { index: "3.5rem", actor: "28%", when: "12rem" };

export default function VenueHistory() {
  const { venueId } = useParams<{ venueId: string }>();
  const { data, error, loadingMore, loadMore } = useVenueHistory(venueId);
  // The event whose details are open, from a click on its row.
  const [opened, setOpened] = useState<VenueHistoryEvent>();
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const rows = useMemo(() => historyRows(data?.events ?? []), [data]);

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    getSubRows: (row) => (row.kind === "run" ? row.children : undefined),
    state: { expanded },
    onExpandedChange: setExpanded,
    // Show more adds rows; keep what was open.
    autoResetExpanded: false,
  });

  return (
    <>
      <DataTable
        table={table}
        widths={widths}
        onRowClick={(row) => {
          if (row.original.kind === "run") row.toggleExpanded();
          else setOpened(row.original.event);
        }}
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
