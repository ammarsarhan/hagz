"use client";

import type { AdminMarketplace } from "@hagz/contracts";
import {
  IconChevronDown,
  IconChevronRight,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
  type ExpandedState,
  type Row,
} from "@tanstack/react-table";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";
import { api } from "@/admin/api";
import { Count, DataTable, RowMenu, Skeleton, TableSearch, Tag } from "@/admin/data-table";
import { Flag } from "@/admin/flag";
import { send } from "@/admin/errors";
import {
  AmenityDialog,
  DeleteDialog,
  LocationDialog,
  MarketplaceDialog,
} from "@/admin/platform/forms";
import {
  localityLabel,
  locationTree,
  useMarketplace,
  type Actions,
  type LocationNode,
} from "@/admin/platform/model";

// A marketplace's page, after the user's reference (Attio's Members): a breadcrumb back to
// Platform, the marketplace's name and settings, a hairline, then its locations as a tree under
// a search and an Add button. Each row's ⋯ adds under it, edits or deletes it.

const features = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});
type LocationRow = Row<typeof features, LocationNode>;
const helper = createColumnHelper<typeof features, LocationNode>();

// Columns are module-level (TanStack needs them stable), so the row menu reaches the page's
// actions and the marketplace through context instead of a closure.
const RowContext = createContext<{ actions: Actions; marketplace: AdminMarketplace } | null>(null);

const percent = (basisPoints: number) => `${basisPoints / 100}%`;
// "8 Nov 2026", in the admin's own time zone.
const added = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function LocationName({ row }: { row: LocationRow }) {
  const { location } = row.original;
  const open = row.getIsExpanded();
  return (
    <div className="flex items-center gap-1.5" style={{ paddingLeft: `${row.depth * 1.5}rem` }}>
      {row.getCanExpand() ? (
        <button
          type="button"
          onClick={row.getToggleExpandedHandler()}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${location.names.en}`}
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
      <span className="truncate font-medium">{location.names.en}</span>
    </div>
  );
}

function LocationMenu({ row }: { row: LocationRow }) {
  const context = useContext(RowContext);
  if (!context) return null;
  const { actions, marketplace } = context;
  const { location } = row.original;
  return (
    <RowMenu
      label={`Actions for ${location.names.en}`}
      items={[
        {
          label: "Add location under",
          icon: IconPlus,
          onSelect: () => actions.addLocation(marketplace, location),
        },
        {
          label: "Edit",
          icon: IconPencil,
          onSelect: () => actions.editLocation(marketplace, location),
        },
        {
          label: "Delete",
          icon: IconTrash,
          tone: "danger",
          onSelect: () => actions.deleteLocation(location),
        },
      ]}
    />
  );
}

const columns = helper.columns([
  helper.accessor((node) => node.location.names.en, {
    id: "name",
    header: "Name",
    cell: ({ row }) => <LocationName row={row} />,
  }),
  helper.display({
    id: "arabic",
    header: "Arabic",
    cell: ({ row }) => (
      <span dir="rtl" lang="ar" className="text-ink-2">
        {row.original.location.names.ar}
      </span>
    ),
  }),
  helper.display({
    id: "kind",
    header: "Kind",
    cell: ({ row }) => <Tag>{localityLabel[row.original.location.locality]}</Tag>,
  }),
  helper.display({
    id: "children",
    header: "Sub-locations",
    cell: ({ row }) => <Count value={row.original.location.childCount} />,
  }),
  helper.display({
    id: "venues",
    header: "Venues",
    cell: ({ row }) => <Count value={row.original.location.venueCount} />,
  }),
  helper.display({
    id: "added",
    header: "Added",
    cell: ({ row }) => <span className="text-ink-2">{added(row.original.location.createdAt)}</span>,
  }),
  helper.display({ id: "menu", header: "", cell: ({ row }) => <LocationMenu row={row} /> }),
]);

const widths = {
  arabic: "17%",
  kind: "13%",
  children: "11%",
  venues: "9%",
  added: "11%",
  menu: "3.5rem",
};

// The tree cut down to what matches the English or Arabic name, with the parents of
// every match kept so it shows where it sits. A match keeps everything under it.
const search = (nodes: LocationNode[], query: string): LocationNode[] => {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.flatMap((node) => {
    const { names } = node.location;
    if ([names.en, names.ar].some((text) => text.toLowerCase().includes(q))) return [node];
    const children = search(node.children, query);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
};

export default function AdminMarketplacePage() {
  const { id } = useParams<{ id: string }>();
  const { data, missing, error, open, actions, close, reload } = useMarketplace(id);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const tree = useMemo(() => (data ? locationTree(data.locations) : []), [data]);
  const searching = query.trim() !== "";
  const shown = useMemo(() => search(tree, query), [tree, query]);

  const table = useTable({
    features,
    columns,
    data: shown,
    getRowId: (node) => node.location.id,
    getSubRows: (node) => node.children,
    // While searching, everything is open so a match deep in the tree shows under its parents.
    state: { expanded: searching ? true : expanded },
    onExpandedChange: setExpanded,
    // The page reloads after every change; keep what was open.
    autoResetExpanded: false,
  });

  if (missing) {
    return (
      <>
        <Breadcrumb current="Not found" />
        <p className="mt-6 text-body text-ink-2">There's no marketplace at this link.</p>
      </>
    );
  }

  const marketplace = data?.marketplace;

  return (
    <>
      <Breadcrumb current={marketplace?.names.en} />

      <div className="mt-4 border-b border-border pb-6">
        <header>
          <div>
            {marketplace ? (
              <>
                <div className="flex items-center gap-2.5">
                  <Flag code={marketplace.code} size="1.75rem" />
                  <h1 className="text-title font-semibold text-ink">{marketplace.names.en}</h1>
                  {marketplace.isActive ? <Tag tone="on">Live</Tag> : <Tag>Hidden</Tag>}
                </div>
                <p className="mt-1 text-body text-ink-2">
                  {marketplace.code} · {marketplace.currency} · {marketplace.dialCode} ·{" "}
                  {marketplace.timezone} · VAT {percent(marketplace.taxRate)} · Commission{" "}
                  {percent(marketplace.commissionRate)}
                </p>
              </>
            ) : (
              // Each line holds an invisible character in the real text style, so it's exactly as
              // tall as what replaces it and nothing jumps when the marketplace lands.
              <div aria-busy>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-6 w-40" />
                  <span aria-hidden className="text-title font-semibold">
                    {"\u200b"}
                  </span>
                </div>
                <p aria-hidden className="mt-1 flex items-center text-body">
                  <Skeleton className="h-3.5 w-96" />
                  {"\u200b"}
                </p>
              </div>
            )}
          </div>
        </header>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <TableSearch value={query} onChange={setQuery} placeholder="Search locations…" />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-field bg-red/10 px-4 py-3 text-label text-red">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <RowContext.Provider value={marketplace ? { actions, marketplace } : null}>
          <DataTable
            table={table}
            widths={widths}
            loading={!data && !error}
            empty={searching ? `No location matches “${query}”.` : "No locations yet."}
          />
        </RowContext.Provider>
      </div>

      {open?.form === "marketplace" && open.marketplace ? (
        <MarketplaceDialog marketplace={open.marketplace} onClose={close} onDone={reload} />
      ) : null}
      {open?.form === "location" ? (
        <LocationDialog
          marketplace={open.marketplace}
          parent={open.parent}
          location={open.location}
          onClose={close}
          onDone={reload}
        />
      ) : null}
      {open?.form === "amenity" ? (
        <AmenityDialog
          marketplace={open.marketplace}
          amenity={open.amenity}
          onClose={close}
          onDone={reload}
        />
      ) : null}
      {open?.form === "deleteLocation" ? (
        <DeleteDialog
          title={`Delete ${open.location.names.en}?`}
          description="Only possible while it has no locations under it and no venues in it."
          request={() =>
            send(
              api.DELETE("/v1/admin/locations/{id}", {
                params: { path: { id: open.location.id } },
              }),
            )
          }
          onClose={close}
          onDone={reload}
        />
      ) : null}
      {open?.form === "deleteAmenity" ? (
        <DeleteDialog
          title={`Delete ${open.amenity.names.en}?`}
          description="Only possible while no venue offers it. Otherwise turn it off."
          request={() =>
            send(
              api.DELETE("/v1/admin/amenities/{id}", {
                params: { path: { id: open.amenity.id } },
              }),
            )
          }
          onClose={close}
          onDone={reload}
        />
      ) : null}
    </>
  );
}

// While the marketplace loads, a bar stands in for its name.
function Breadcrumb({ current }: { current?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-label">
      <Link href="/admin/platform" className="text-ink-2 hover:text-ink">
        Platform
      </Link>
      <span className="text-ink-3">/</span>
      {current ? (
        <span aria-current="page" className="font-medium text-ink">
          {current}
        </span>
      ) : (
        <Skeleton className="h-3 w-16" />
      )}
    </nav>
  );
}
