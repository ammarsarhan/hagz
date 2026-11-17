"use client";

import { PIN_NEAR_AREA_METRES, type AdminLocation, type AdminVenueLocation } from "@hagz/contracts";
import { IconCheck } from "@tabler/icons-react";
import {
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
  type ExpandedState,
} from "@tanstack/react-table";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { DataTable, TableSearch, Tag } from "@/admin/data-table";
import { Modal } from "@/admin/dialog";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";
import { LocationName, searchLocations } from "@/admin/platform/location-tree";
import { localityLabel, locationTree, type LocationNode } from "@/admin/platform/model";
import { useSubmit } from "@/admin/submit";
import { formatDistance, metresBetween } from "./location";

// Setting the area a venue is listed under, in a modal over its Location: the marketplace's
// locations as the tree of its Locations tab (Platform › the marketplace), with the same search.
// Only the leaves can hold a venue (a neighbourhood or a city, not a governorate): clicking one picks
// it, clicking a parent opens it. Each leaf shows how far its centre is from the pin. The tree opens
// on the venue's area, or the nearest one when it has none. The API checks the pin is close enough.

const features = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});
const helper = createColumnHelper<typeof features, LocationNode>();

// Columns are module-level (TanStack needs them stable), so the pick and the pin reach the cells
// through context instead of a closure.
const PickContext = createContext<{
  picked?: string;
  pin: AdminVenueLocation["coordinates"];
} | null>(null);

function Distance({ node }: { node: LocationNode }) {
  const context = useContext(PickContext);
  const { center, childCount } = node.location;
  if (childCount > 0 || !context?.pin) return null;
  if (!center) return <span className="text-ink-3">No centre</span>;
  const metres = metresBetween(context.pin, center);
  // Black within the API's limit, where saving it would be accepted; grey beyond.
  return (
    <span className={`tabular-nums ${metres <= PIN_NEAR_AREA_METRES ? "text-ink" : "text-ink-2"}`}>
      {formatDistance(metres)}
    </span>
  );
}

function Picked({ node }: { node: LocationNode }) {
  const context = useContext(PickContext);
  return node.location.id === context?.picked ? (
    <IconCheck size={18} className="size-[1.125rem] text-ink" stroke={2.25} aria-label="Picked" />
  ) : null;
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
    id: "distance",
    header: "From the pin",
    cell: ({ row }) => <Distance node={row.original} />,
  }),
  helper.display({ id: "picked", header: "", cell: ({ row }) => <Picked node={row.original} /> }),
]);

const widths = { arabic: "22%", kind: "18%", distance: "17%", picked: "2.75rem" };

// Every location above this one, so the tree can open down to it.
const ancestorsOf = (locations: AdminLocation[], id: string) => {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const open: Record<string, boolean> = {};
  let parentId = byId.get(id)?.parentId ?? null;
  while (parentId) {
    open[parentId] = true;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return open;
};

// The leaf nearest the pin: where the tree opens for a venue without an area.
const nearestLeaf = (locations: AdminLocation[], pin: AdminVenueLocation["coordinates"]) => {
  if (!pin) return undefined;
  let best: { id: string; metres: number } | undefined;
  for (const location of locations) {
    if (location.childCount > 0 || !location.center) continue;
    const metres = metresBetween(pin, location.center);
    if (!best || metres < best.metres) best = { id: location.id, metres };
  }
  return best?.id;
};

export function AreaDialog({
  venueId,
  marketplaceId,
  location,
  onClose,
  onDone,
}: {
  venueId: string;
  marketplaceId: string;
  location: AdminVenueLocation;
  onClose: () => void;
  onDone: () => void;
}) {
  const [locations, setLocations] = useState<AdminLocation[]>();
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [picked, setPicked] = useState(location.area?.id);
  const { busy, run } = useSubmit(onDone, onClose);
  const hud = useHud();

  // Errors go to the HUD, over the modal, like every modal's (admin/submit.ts).
  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/marketplaces/{id}/locations", {
        params: { path: { id: marketplaceId } },
      }),
    );
    if (!result.ok) {
      setFailed(true);
      hud(
        message(result.error),
        notTheirFault(result.error) ? { label: "Try again", run: () => void load() } : undefined,
      );
      return;
    }
    setFailed(false);
    setLocations(result.data.data);
    const focus = location.area?.id ?? nearestLeaf(result.data.data, location.coordinates);
    if (focus) setExpanded(ancestorsOf(result.data.data, focus));
  }, [marketplaceId, hud, location.area?.id, location.coordinates]);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo(() => (locations ? locationTree(locations) : []), [locations]);
  const searching = query.trim() !== "";
  const shown = useMemo(() => searchLocations(tree, query), [tree, query]);

  const table = useTable({
    features,
    columns,
    data: shown,
    getRowId: (node) => node.location.id,
    getSubRows: (node) => node.children,
    // While searching, everything is open so a match deep in the tree shows under its parents.
    state: { expanded: searching ? true : expanded },
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
  });

  // Save stays grey until an area other than the current one is picked.
  const ready = picked !== undefined && picked !== location.area?.id;

  const submit = () => {
    if (!ready) return;
    void run(() =>
      send(
        api.PUT("/v1/admin/venues/{id}/area", {
          params: { path: { id: venueId } },
          body: { locationId: picked },
        }),
      ),
    );
  };

  return (
    <Modal
      size="large"
      onClose={onClose}
      title={location.area ? "Change area" : "Set area"}
      description={
        location.requestedArea
          ? `The owner asked for “${location.requestedArea}”. If it isn’t here, add it under Platform › Locations first.`
          : "Where players find the venue. Pick a neighbourhood or a city."
      }
      footer={
        <>
          <Button variant="secondary" size="small" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="small" loading={busy} disabled={!ready} onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      {/* Stays where it is while the tree scrolls under it. A sticky box sticks inside its scroller's
          padding, so it sticks 1.5rem higher (at the scroller's edge) and fills that band with its
          own white padding; otherwise rows show through above it. */}
      <div className="sticky -top-6 z-10 -mt-6 bg-white pt-4 pb-4">
        <TableSearch value={query} onChange={setQuery} placeholder="Search areas…" />
      </div>
      <div>
        <PickContext.Provider value={{ picked, pin: location.coordinates }}>
          <DataTable
            table={table}
            widths={widths}
            loading={!locations && !failed}
            isSelected={(row) => row.original.location.id === picked}
            onRowClick={(row) => {
              if (row.getCanExpand()) row.toggleExpanded();
              else setPicked(row.original.location.id);
            }}
            empty={
              failed
                ? "The areas didn’t load."
                : searching
                  ? `No area matches “${query.trim()}”.`
                  : "This marketplace has no areas yet."
            }
          />
        </PickContext.Provider>
      </div>
    </Modal>
  );
}
