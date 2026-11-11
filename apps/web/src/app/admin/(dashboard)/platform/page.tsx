"use client";

import type { AdminMarketplace } from "@hagz/contracts";
import { IconArrowRight, IconPencil, IconPlus } from "@tabler/icons-react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  globalFilteringFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { Button } from "@/admin/button";
import { Count, DataTable, RowMenu, TableSearch, Tag } from "@/admin/data-table";
import { Flag } from "@/admin/flag";
import { PageHeader } from "@/admin/page-header";
import { AddMarketplaceDialog } from "@/admin/platform/add-marketplace";
import { EditMarketplacePanel } from "@/admin/platform/forms";
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
        <Flag code={m.code} />
        <span className="truncate text-ink">{m.names.en}</span>
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
    cell: ({ row: { original: m } }) => <Count value={m.venueCount} />,
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: ({ row: { original: m } }) =>
      m.isActive ? <Tag tone="on">Live</Tag> : <Tag>Hidden</Tag>,
  }),
  helper.display({
    id: "menu",
    header: "",
    cell: ({ row }) => <MarketplaceMenu marketplace={row.original} />,
  }),
]);

// Columns are module-level (TanStack needs them stable), so the row menu reaches the page through
// context instead of a closure.
const RowContext = createContext<{
  open: (marketplace: AdminMarketplace) => void;
  edit: (marketplace: AdminMarketplace) => void;
} | null>(null);

function MarketplaceMenu({ marketplace }: { marketplace: AdminMarketplace }) {
  const context = useContext(RowContext);
  if (!context) return null;
  return (
    <RowMenu
      label={`Actions for ${marketplace.names.en}`}
      items={[
        { label: "Open", icon: IconArrowRight, onSelect: () => context.open(marketplace) },
        { label: "Edit", icon: IconPencil, onSelect: () => context.edit(marketplace) },
      ]}
    />
  );
}

const widths = {
  money: "9%",
  vat: "8%",
  commission: "10%",
  locations: "9%",
  venues: "8%",
  status: "9%",
  menu: "3.5rem",
};

// Matches the English or Arabic name, or the country code.
const matches = (m: AdminMarketplace, query: string) => {
  const q = query.trim().toLowerCase();
  return [m.names.en, m.names.ar, m.code].some((text) => text.toLowerCase().includes(q));
};

export default function AdminPlatform() {
  const router = useRouter();
  const { marketplaces, error, reload } = useMarketplaces();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminMarketplace>();
  const openMarketplace = (marketplace: AdminMarketplace) =>
    router.push(`/admin/platform/${marketplace.id}`);

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
        actions={
          <Button size="small" onClick={() => setAdding(true)} disabled={!marketplaces}>
            <IconPlus size={16} className="size-4" stroke={2} />
            Add marketplace
          </Button>
        }
      />

      <div className="mt-8 flex items-center gap-2">
        <TableSearch value={query} onChange={setQuery} placeholder="Search marketplaces…" />
      </div>

      <div className="mt-4">
        <RowContext.Provider value={{ open: openMarketplace, edit: setEditing }}>
          <DataTable
            table={table}
            widths={widths}
            onRowClick={(row) => openMarketplace(row.original)}
            loading={!marketplaces && !error}
            empty={error ?? (query ? `No marketplace matches “${query}”.` : "No marketplaces yet.")}
          />
        </RowContext.Provider>
      </div>

      {adding && marketplaces ? (
        <AddMarketplaceDialog
          taken={marketplaces.map((marketplace) => marketplace.code)}
          onClose={() => setAdding(false)}
          onDone={reload}
        />
      ) : null}
      {editing ? (
        <EditMarketplacePanel
          marketplace={editing}
          lastLive={
            editing.isActive &&
            !(marketplaces ?? []).some((other) => other.isActive && other.id !== editing.id)
          }
          onClose={() => setEditing(undefined)}
          onDone={reload}
        />
      ) : null}
    </>
  );
}
