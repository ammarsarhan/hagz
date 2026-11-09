"use client";

import type { AdminMarketplace } from "@hagz/contracts";
import { IconChevronRight } from "@tabler/icons-react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  globalFilteringFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, TableSearch, Tag } from "@/admin/data-table";
import { PageHeader } from "@/admin/page-header";
import { useMarketplaces } from "@/admin/platform/model";

// Platform: the marketplaces, after the user's reference (Mobbin's Skills list). Each row opens the
// marketplace's own page, with its locations.

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
});
const helper = createColumnHelper<typeof features, AdminMarketplace>();

const percent = (basisPoints: number) => `${basisPoints / 100}%`;
const count = (value: number) => value.toLocaleString("en");

const columns = helper.columns([
  helper.accessor((m) => m.names.en, {
    id: "name",
    header: "Name",
    cell: ({ row: { original: m } }) => (
      <div className="flex items-center gap-3">
        {/* The country code stands in for an icon: a grey tile, like the reference's. */}
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-chip text-caption font-semibold text-ink">
          {m.code}
        </span>
        <span className="truncate font-medium">{m.names.en}</span>
        <span dir="rtl" lang="ar" className="truncate text-ink-3">
          {m.names.ar}
        </span>
      </div>
    ),
  }),
  helper.display({
    id: "money",
    header: "Currency",
    cell: ({ row: { original: m } }) => <span className="text-ink-2">{m.currency}</span>,
  }),
  helper.display({
    id: "vat",
    header: "VAT",
    cell: ({ row: { original: m } }) => <span className="text-ink-2">{percent(m.taxRate)}</span>,
  }),
  helper.display({
    id: "commission",
    header: "Commission",
    cell: ({ row: { original: m } }) => (
      <span className="text-ink-2">{percent(m.commissionRate)}</span>
    ),
  }),
  helper.display({
    id: "locations",
    header: "Locations",
    cell: ({ row: { original: m } }) => (
      <span className="text-ink-2">{count(m.locationCount)}</span>
    ),
  }),
  helper.display({
    id: "venues",
    header: "Venues",
    cell: ({ row: { original: m } }) => <span className="text-ink-2">{count(m.venueCount)}</span>,
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: ({ row: { original: m } }) =>
      m.isActive ? <Tag tone="on">Live</Tag> : <Tag>Hidden</Tag>,
  }),
  helper.display({
    id: "open",
    header: "",
    cell: () => <IconChevronRight size={16} className="ml-auto size-4 text-ink-3" stroke={1.75} />,
  }),
]);

const widths = {
  money: "9%",
  vat: "8%",
  commission: "10%",
  locations: "9%",
  venues: "8%",
  status: "9%",
  open: "2.75rem",
};

// Matches the English or Arabic name, or the country code.
const matches = (m: AdminMarketplace, query: string) => {
  const q = query.trim().toLowerCase();
  return [m.names.en, m.names.ar, m.code].some((text) => text.toLowerCase().includes(q));
};

export default function AdminPlatform() {
  const router = useRouter();
  const { marketplaces, error } = useMarketplaces();
  const [query, setQuery] = useState("");

  const table = useTable({
    features,
    columns,
    data: marketplaces ?? [],
    getRowId: (m) => m.id,
    state: { globalFilter: query },
    onGlobalFilterChange: setQuery,
    // One search over the whole row, run once per row from the name column.
    getColumnCanGlobalFilter: (column) => column.id === "name",
    globalFilterFn: (row, _columnId, value: string) => matches(row.original, value),
  });

  return (
    <>
      <PageHeader
        title="Platform"
        subtitle="Marketplaces, their locations and the amenities venues can offer."
      />

      <div className="mt-8 flex items-center gap-2">
        <TableSearch value={query} onChange={setQuery} placeholder="Search marketplaces…" />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-field bg-red/10 px-4 py-3 text-label text-red">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <DataTable
          table={table}
          widths={widths}
          onRowClick={(row) => router.push(`/admin/platform/${row.original.id}`)}
          empty={
            !marketplaces
              ? "Loading…"
              : query
                ? `No marketplace matches “${query}”.`
                : "No marketplaces yet."
          }
        />
      </div>
    </>
  );
}
