"use client";

import type { AdminAmenity, AdminLocation, AdminMarketplace } from "@hagz/contracts";
import {
  IconChevronDown,
  IconChevronRight,
  IconEye,
  IconEyeOff,
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
import { createContext, Fragment, useContext, type ReactNode } from "react";

// The Platform page's table, after the user's reference (grouped transactions): each marketplace is
// a grey group row with its figures and actions, its own column headers under it, then its rows.
// Locations nest under their parents and expand like the groups do. One TanStack table drives both
// tabs; only the columns change.

export type Node =
  | { kind: "marketplace"; id: string; marketplace: AdminMarketplace; children: Node[] }
  | {
      kind: "location";
      id: string;
      marketplace: AdminMarketplace;
      location: AdminLocation;
      children: Node[];
    }
  | { kind: "amenity"; id: string; marketplace: AdminMarketplace; amenity: AdminAmenity };

// What the rows can ask the page to do. Columns are module-level (TanStack needs them stable), so
// their cells reach the page's handlers through this context instead of closures.
export interface Actions {
  editMarketplace: (marketplace: AdminMarketplace) => void;
  addLocation: (marketplace: AdminMarketplace, parent: AdminLocation | null) => void;
  editLocation: (marketplace: AdminMarketplace, location: AdminLocation) => void;
  deleteLocation: (location: AdminLocation) => void;
  addAmenity: (marketplace: AdminMarketplace) => void;
  editAmenity: (amenity: AdminAmenity) => void;
  toggleAmenity: (amenity: AdminAmenity) => void;
  deleteAmenity: (amenity: AdminAmenity) => void;
}
const ActionsContext = createContext<Actions | null>(null);
const useActions = () => {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error("Platform table cells need the Actions context.");
  return actions;
};

const features = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});
type PlatformRow = Row<typeof features, Node>;
const helper = createColumnHelper<typeof features, Node>();

export const localityLabel: Record<AdminLocation["locality"], string> = {
  REGION: "Region",
  EMIRATE: "Emirate",
  GOVERNORATE: "Governorate",
  MUNICIPALITY: "Municipality",
  WILAYAT: "Wilayat",
  CITY: "City",
  DISTRICT: "District",
  AREA: "Area",
  NEIGHBORHOOD: "Neighborhood",
};

const percent = (basisPoints: number) => `${basisPoints / 100}%`;
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en")} ${count === 1 ? one : many}`;

// A small text button for row and group actions.
function Action({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-label font-medium transition-colors ${
        tone === "danger"
          ? "text-ink-2 hover:bg-red/10 hover:text-red"
          : "text-ink-2 hover:bg-chip hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const icon = (Item: typeof IconPlus) => <Item size={16} className="size-4" stroke={1.75} />;

function Chevron({ row }: { row: PlatformRow }) {
  if (!row.getCanExpand()) return <span className="inline-block size-6" />;
  const open = row.getIsExpanded();
  return (
    <button
      type="button"
      onClick={row.getToggleExpandedHandler()}
      aria-expanded={open}
      aria-label={open ? "Collapse" : "Expand"}
      className="flex size-6 cursor-pointer items-center justify-center rounded-[0.375rem] text-ink-2 hover:bg-black/5 hover:text-ink"
    >
      {open ? icon(IconChevronDown) : icon(IconChevronRight)}
    </button>
  );
}

function Status({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={`rounded-[0.3125rem] px-1.5 py-px text-[0.75rem] font-semibold ${
        on ? "bg-green/10 text-green" : "bg-chip text-ink-2"
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

// --- Location columns ---

function LocationName({ row }: { row: PlatformRow }) {
  if (row.original.kind !== "location") return null;
  // Depth 1 is a top-level location (depth 0 is the marketplace group).
  return (
    <div
      className="flex items-center gap-1.5"
      style={{ paddingLeft: `${(row.depth - 1) * 1.5}rem` }}
    >
      <Chevron row={row} />
      <span className="font-medium text-ink">{row.original.location.names.en}</span>
      {row.original.location.childCount ? (
        <span className="text-caption text-ink-3">{row.original.location.childCount}</span>
      ) : null}
    </div>
  );
}

function LocationActions({ row }: { row: PlatformRow }) {
  const actions = useActions();
  if (row.original.kind !== "location") return null;
  const { marketplace, location } = row.original;
  return (
    <div className="flex justify-end gap-0.5">
      <Action
        icon={icon(IconPlus)}
        label="Add under"
        onClick={() => actions.addLocation(marketplace, location)}
      />
      <Action
        icon={icon(IconPencil)}
        label="Edit"
        onClick={() => actions.editLocation(marketplace, location)}
      />
      <Action
        icon={icon(IconTrash)}
        label="Delete"
        tone="danger"
        onClick={() => actions.deleteLocation(location)}
      />
    </div>
  );
}

const location = (row: PlatformRow) =>
  row.original.kind === "location" ? row.original.location : null;

export const locationColumns = helper.columns([
  helper.display({ id: "name", header: "Name", cell: ({ row }) => <LocationName row={row} /> }),
  helper.display({
    id: "arabic",
    header: "Arabic",
    cell: ({ row }) => (
      <span dir="rtl" lang="ar">
        {location(row)?.names.ar}
      </span>
    ),
  }),
  helper.display({
    id: "kind",
    header: "Kind",
    cell: ({ row }) => {
      const l = location(row);
      return l ? localityLabel[l.locality] : null;
    },
  }),
  helper.display({
    id: "slug",
    header: "Slug",
    cell: ({ row }) => <code className="text-caption text-ink-2">{location(row)?.slug}</code>,
  }),
  helper.display({
    id: "venues",
    header: "Venues",
    cell: ({ row }) => location(row)?.venueCount.toLocaleString("en"),
  }),
  helper.display({ id: "actions", header: "", cell: ({ row }) => <LocationActions row={row} /> }),
]);

// --- Amenity columns ---

function AmenityActions({ row }: { row: PlatformRow }) {
  const actions = useActions();
  if (row.original.kind !== "amenity") return null;
  const { amenity } = row.original;
  return (
    <div className="flex justify-end gap-0.5">
      <Action icon={icon(IconPencil)} label="Edit" onClick={() => actions.editAmenity(amenity)} />
      <Action
        icon={icon(amenity.isActive ? IconEyeOff : IconEye)}
        label={amenity.isActive ? "Turn off" : "Turn on"}
        onClick={() => actions.toggleAmenity(amenity)}
      />
      <Action
        icon={icon(IconTrash)}
        label="Delete"
        tone="danger"
        onClick={() => actions.deleteAmenity(amenity)}
      />
    </div>
  );
}

const amenity = (row: PlatformRow) =>
  row.original.kind === "amenity" ? row.original.amenity : null;

export const amenityColumns = helper.columns([
  helper.display({
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="pl-7.5 font-medium text-ink">{amenity(row)?.names.en}</span>
    ),
  }),
  helper.display({
    id: "arabic",
    header: "Arabic",
    cell: ({ row }) => (
      <span dir="rtl" lang="ar">
        {amenity(row)?.names.ar}
      </span>
    ),
  }),
  helper.display({
    id: "key",
    header: "Key",
    cell: ({ row }) => <code className="text-caption text-ink-2">{amenity(row)?.key}</code>,
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const a = amenity(row);
      return a ? <Status on={a.isActive} onLabel="On" offLabel="Off" /> : null;
    },
  }),
  helper.display({
    id: "venues",
    header: "Venues",
    cell: ({ row }) => amenity(row)?.venueCount.toLocaleString("en"),
  }),
  helper.display({ id: "actions", header: "", cell: ({ row }) => <AmenityActions row={row} /> }),
]);

// --- Group row ---

function GroupRow({
  row,
  tab,
  colSpan,
}: {
  row: PlatformRow;
  tab: "locations" | "amenities";
  colSpan: number;
}) {
  const actions = useActions();
  if (row.original.kind !== "marketplace") return null;
  const { marketplace: m } = row.original;
  const count =
    tab === "locations"
      ? plural(m.locationCount, "location")
      : plural(m.amenityCount, "amenity", "amenities");
  return (
    <tr className="border-t border-white bg-[#eef0f2]">
      <td colSpan={colSpan} className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Chevron row={row} />
          <span className="font-semibold text-ink">{m.names.en}</span>
          <span className="rounded-[0.3125rem] bg-white px-1.5 py-px text-[0.75rem] font-semibold text-ink-2">
            {m.code}
          </span>
          <Status on={m.isActive} onLabel="Live" offLabel="Hidden" />
          <span className="ml-6 text-label text-ink-2">{count}</span>
          <span className="ml-auto text-label text-ink-2">
            {m.currency} · VAT {percent(m.taxRate)} · Commission {percent(m.commissionRate)}
          </span>
          <div className="flex gap-0.5">
            <Action
              icon={icon(IconPencil)}
              label="Edit"
              onClick={() => actions.editMarketplace(m)}
            />
            <Action
              icon={icon(IconPlus)}
              label={tab === "locations" ? "Add location" : "Add amenity"}
              onClick={() =>
                tab === "locations" ? actions.addLocation(m, null) : actions.addAmenity(m)
              }
            />
          </div>
        </div>
      </td>
    </tr>
  );
}

// Column widths, by column id. The name takes what's left.
const widths: Record<string, string> = {
  arabic: "16%",
  kind: "11%",
  key: "13%",
  slug: "14%",
  status: "9%",
  venues: "7%",
  actions: "21rem",
};

export function PlatformTable({
  tab,
  nodes,
  expanded,
  onExpandedChange,
  actions,
}: {
  tab: "locations" | "amenities";
  nodes: Node[];
  expanded: ExpandedState;
  onExpandedChange: (updater: ExpandedState | ((old: ExpandedState) => ExpandedState)) => void;
  actions: Actions;
}) {
  const table = useTable({
    features,
    columns: tab === "locations" ? locationColumns : amenityColumns,
    data: nodes,
    getRowId: (node) => node.id,
    getSubRows: (node) => (node.kind === "amenity" ? undefined : node.children),
    // Group rows open even when empty, to show their "nothing here yet" line.
    getRowCanExpand: (row) => row.original.kind === "marketplace" || row.subRows.length > 0,
    state: { expanded },
    onExpandedChange,
    // The page reloads after every change; keep what was open.
    autoResetExpanded: false,
  });

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const colSpan = headers.length;

  return (
    <ActionsContext.Provider value={actions}>
      <table className="w-full table-fixed border-collapse text-body">
        <colgroup>
          {headers.map((header) => (
            <col key={header.id} style={{ width: widths[header.column.id] }} />
          ))}
        </colgroup>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            if (row.original.kind !== "marketplace") {
              return (
                <tr key={row.id} className="border-t border-border hover:bg-[#fafafa]">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="truncate px-3 py-2 text-ink">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              );
            }
            const open = row.getIsExpanded();
            return (
              <Fragment key={row.id}>
                <GroupRow row={row} tab={tab} colSpan={colSpan} />
                {open && row.subRows.length > 0 ? (
                  <tr>
                    {headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        className={`px-3 pt-3 pb-2 text-left text-caption font-medium text-ink-2 ${
                          header.column.id === "name" ? "pl-[2.625rem]" : ""
                        }`}
                      >
                        <table.FlexRender header={header} />
                      </th>
                    ))}
                  </tr>
                ) : null}
                {open && row.subRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-6 text-center text-label text-ink-2">
                      {tab === "locations"
                        ? "No locations yet. Add the first one from the group row."
                        : "No amenities yet. Add the first one from the group row."}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </ActionsContext.Provider>
  );
}
