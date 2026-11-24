"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BookingEventModal } from "@/admin/bookings/event-modal";
import { eventLabel, useBookingHistory, type BookingHistoryEvent } from "@/admin/bookings/history";
import { Button } from "@/admin/button";
import { DataTable, Tag } from "@/admin/data-table";
import { dateTime } from "@/admin/venues/history";

// A booking's History tab: its events, newest first, in the admin's one table design, as a venue's
// History is. A page at a time; Show more fetches the next. Clicking an event opens it in full.

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, BookingHistoryEvent>();

// Who did it: the player or staff by name, an admin with a tag, the system (the expiry sweep, a
// payment's outcome) as a System tag. A name is missing when the account is gone.
function Actor({ actor }: { actor: BookingHistoryEvent["actor"] }) {
  if (actor.kind === "SYSTEM") return <Tag>System</Tag>;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {actor.name ? (
        <span className="truncate text-ink-2">{actor.name}</span>
      ) : (
        <span className="text-ink-3">Unknown</span>
      )}
      <Tag>{actor.kind === "CUSTOMER" ? "Player" : actor.kind === "STAFF" ? "Staff" : "Admin"}</Tag>
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

export default function BookingHistory() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { data, error, loadingMore, loadMore } = useBookingHistory(bookingId);
  const [opened, setOpened] = useState<BookingHistoryEvent>();

  const table = useTable({
    features,
    columns,
    data: data?.events ?? [],
    getRowId: (event) => event.id,
  });

  return (
    <section>
      <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">History</h2>
      <p className="mt-1 text-body text-ink-2">
        Everything that happened to this booking, newest first: who did it and when. Open an event
        to see it in full.
      </p>

      <div className="mt-8">
        <DataTable
          table={table}
          widths={widths}
          onRowClick={(row) => setOpened(row.original)}
          loading={!data && !error}
          empty={error ?? "Nothing has happened to this booking yet."}
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
      </div>
      {opened ? <BookingEventModal event={opened} onClose={() => setOpened(undefined)} /> : null}
    </section>
  );
}
