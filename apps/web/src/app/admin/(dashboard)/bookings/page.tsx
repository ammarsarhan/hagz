"use client";

import type { AdminBooking, BookingStatus } from "@hagz/contracts";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  bookingHref,
  bookingTime,
  STATUSES,
  statusLabel,
  statusTone,
  useBookings,
} from "@/admin/bookings/model";
import { Button } from "@/admin/button";
import { DataTable, TableSearch, Tag } from "@/admin/data-table";
import { formatMoney } from "@/admin/money";
import { PageHeader } from "@/admin/page-header";
import { TabPanel, Tabs } from "@/admin/tabs";

// Every booking at every venue, in the admin's one table design, to look one up for support. Tabs
// filter by status and the search goes to the API (code, customer, phone, venue), which sends a page
// at a time: Show more below the table fetches the next. Clicking a row opens the booking.

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AdminBooking>();

const columns = helper.columns([
  helper.display({
    id: "index",
    header: "#",
    cell: ({ row }) => <span className="text-ink-3 tabular-nums">{row.index + 1}</span>,
  }),
  helper.display({
    id: "code",
    header: "Code",
    cell: ({ row }) => <span className="font-mono text-caption text-ink">{row.original.code}</span>,
  }),
  helper.display({
    id: "customer",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-ink">{row.original.customer.name}</span>
        {row.original.customer.phone ? (
          <span className="truncate text-caption text-ink-3 tabular-nums">
            {row.original.customer.phone}
          </span>
        ) : null}
      </div>
    ),
  }),
  helper.display({
    id: "venue",
    header: "Venue",
    cell: ({ row }) => {
      const { venue, ground } = row.original;
      return (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-ink-2">
            {venue.names.en ?? venue.names.ar ?? venue.slug}
          </span>
          {ground.name ? (
            <span className="truncate text-caption text-ink-3">{ground.name}</span>
          ) : null}
        </div>
      );
    },
  }),
  helper.display({
    id: "time",
    header: "Time",
    cell: ({ row }) => (
      <span className="truncate text-ink-2 tabular-nums">
        {bookingTime(row.original.startsAt, row.original.endsAt, row.original.timezone)}
      </span>
    ),
  }),
  helper.display({
    id: "total",
    header: "Total",
    cell: ({ row }) => (
      <span className="text-ink-2 tabular-nums">
        {formatMoney(row.original.currency, row.original.total)}
      </span>
    ),
  }),
  helper.display({
    id: "source",
    header: "Source",
    cell: ({ row }) => <Tag>{row.original.source === "APP" ? "App" : "Staff"}</Tag>,
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Tag tone={statusTone(row.original.status)}>{statusLabel[row.original.status]}</Tag>
    ),
  }),
]);

// Customer and Venue take what's left.
const widths = {
  index: "3.5rem",
  code: "7rem",
  time: "17.5rem",
  total: "7rem",
  source: "5rem",
  status: "9.5rem",
};

type Section = "ALL" | BookingStatus;

export default function AdminBookings() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("ALL");
  const [query, setQuery] = useState("");
  const status = section === "ALL" ? undefined : section;
  const { data, error, loadingMore, loadMore } = useBookings(status, query);

  const table = useTable({
    features,
    columns,
    data: data?.bookings ?? [],
    getRowId: (booking) => booking.id,
  });

  const counts = data?.counts;
  const total = counts ? STATUSES.reduce((sum, s) => sum + counts[s], 0) : undefined;
  const searching = query.trim() !== "";

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every booking at every venue." />

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
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search code, customer or venue…"
          />
        </div>
        <div className="mt-4">
          <DataTable
            table={table}
            widths={widths}
            onRowClick={(row) => router.push(bookingHref(row.original.id, "details"))}
            loading={!data && !error}
            empty={
              error ??
              (searching
                ? `No booking matches “${query.trim()}”.`
                : status
                  ? `No ${statusLabel[status].toLowerCase()} bookings.`
                  : "No bookings yet.")
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
