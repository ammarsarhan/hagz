"use client";

import type { AdminAmenity, AdminLocation, AdminMarketplace } from "@hagz/contracts";
import type { ExpandedState } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { message, send } from "@/admin/errors";
import { PageHeader } from "@/admin/page-header";
import {
  AmenityDialog,
  DeleteDialog,
  LocationDialog,
  MarketplaceDialog,
} from "@/admin/platform/forms";
import { PlatformTable, type Actions, type Node } from "@/admin/platform/table";

interface Loaded {
  marketplace: AdminMarketplace;
  locations: AdminLocation[];
  amenities: AdminAmenity[];
}

type Tab = "locations" | "amenities";

// Which form is open, with what it needs.
type Open =
  | { form: "marketplace"; marketplace?: AdminMarketplace }
  | {
      form: "location";
      marketplace: AdminMarketplace;
      parent?: AdminLocation | null;
      location?: AdminLocation;
    }
  | { form: "amenity"; marketplace?: AdminMarketplace; amenity?: AdminAmenity }
  | { form: "deleteLocation"; location: AdminLocation }
  | { form: "deleteAmenity"; amenity: AdminAmenity };

const byName = (a: { names: { en: string } }, b: { names: { en: string } }) =>
  a.names.en.localeCompare(b.names.en, "en");

// The location tree from the flat list: children under their parents, each level by name.
const locationTree = (marketplace: AdminMarketplace, locations: AdminLocation[]): Node[] => {
  const children = new Map<string | null, AdminLocation[]>();
  for (const location of locations) {
    const siblings = children.get(location.parentId) ?? [];
    siblings.push(location);
    children.set(location.parentId, siblings);
  }
  const build = (parentId: string | null): Node[] =>
    (children.get(parentId) ?? []).sort(byName).map((location) => ({
      kind: "location",
      id: `l:${location.id}`,
      marketplace,
      location,
      children: build(location.id),
    }));
  return build(null);
};

// Platform: marketplaces, with each one's location tree or amenity catalog under it.
export default function AdminPlatform() {
  const [data, setData] = useState<Loaded[]>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>("locations");
  const [open, setOpen] = useState<Open>();
  const [expanded, setExpanded] = useState<ExpandedState>({});
  // Marketplaces seen so far: new ones open, ones the admin closed stay closed after a reload.
  const seen = useRef(new Set<string>());

  const load = useCallback(async () => {
    const result = await send(api.GET("/v1/admin/marketplaces"));
    if (!result.ok) {
      setError(message(result.error));
      return;
    }
    const loaded = await Promise.all(
      result.data.data.map(async (marketplace) => {
        const path = { params: { path: { id: marketplace.id } } };
        const [locations, amenities] = await Promise.all([
          send(api.GET("/v1/admin/marketplaces/{id}/locations", path)),
          send(api.GET("/v1/admin/marketplaces/{id}/amenities", path)),
        ]);
        if (!locations.ok) throw locations.error;
        if (!amenities.ok) throw amenities.error;
        return { marketplace, locations: locations.data.data, amenities: amenities.data.data };
      }),
    ).catch((failure: unknown) => {
      setError(message(failure));
      return undefined;
    });
    if (!loaded) return;
    setError(undefined);
    setData(loaded);
    const fresh = loaded.filter(({ marketplace }) => !seen.current.has(marketplace.id));
    for (const { marketplace } of fresh) seen.current.add(marketplace.id);
    if (fresh.length) {
      setExpanded((old) => ({
        ...(old === true ? {} : old),
        ...Object.fromEntries(fresh.map(({ marketplace }) => [`m:${marketplace.id}`, true])),
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nodes = useMemo<Node[]>(
    () =>
      (data ?? []).map(({ marketplace, locations, amenities }) => ({
        kind: "marketplace",
        id: `m:${marketplace.id}`,
        marketplace,
        children:
          tab === "locations"
            ? locationTree(marketplace, locations)
            : [...amenities].sort(byName).map((amenity) => ({
                kind: "amenity",
                id: `a:${amenity.id}`,
                marketplace,
                amenity,
              })),
      })),
    [data, tab],
  );

  const actions = useMemo<Actions>(
    () => ({
      editMarketplace: (marketplace) => setOpen({ form: "marketplace", marketplace }),
      addLocation: (marketplace, parent) => setOpen({ form: "location", marketplace, parent }),
      editLocation: (marketplace, location) => setOpen({ form: "location", marketplace, location }),
      deleteLocation: (location) => setOpen({ form: "deleteLocation", location }),
      addAmenity: (marketplace) => setOpen({ form: "amenity", marketplace }),
      editAmenity: (amenity) => setOpen({ form: "amenity", amenity }),
      toggleAmenity: (amenity) => {
        void send(
          api.PATCH("/v1/admin/amenities/{id}", {
            params: { path: { id: amenity.id } },
            body: { isActive: !amenity.isActive },
          }),
        ).then((result) => (result.ok ? load() : setError(message(result.error))));
      },
      deleteAmenity: (amenity) => setOpen({ form: "deleteAmenity", amenity }),
    }),
    [load],
  );

  const close = () => setOpen(undefined);
  const reload = () => void load();
  const totals = (data ?? []).reduce(
    (sum, { locations, amenities }) => ({
      locations: sum.locations + locations.length,
      amenities: sum.amenities + amenities.length,
    }),
    { locations: 0, amenities: 0 },
  );

  return (
    <>
      <PageHeader
        title="Platform"
        subtitle="Marketplaces, their locations and the amenities venues can offer."
        actions={
          <div className="w-48">
            <Button onClick={() => setOpen({ form: "marketplace" })}>Add marketplace</Button>
          </div>
        }
      />

      <div role="tablist" className="mt-8 flex gap-6 border-b border-border">
        {(["locations", "amenities"] as const).map((name) => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`-mb-px cursor-pointer border-b-2 pb-2.5 text-body font-medium capitalize ${
              tab === name ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-field bg-red/10 px-4 py-3 text-label text-red">
          {error}
        </p>
      ) : null}

      {data === undefined ? null : data.length === 0 ? (
        <p className="mt-10 text-center text-label text-ink-2">
          No marketplaces yet. Add the first country Hagz operates in.
        </p>
      ) : (
        <div className="mt-4">
          <PlatformTable
            tab={tab}
            nodes={nodes}
            expanded={expanded}
            onExpandedChange={(updater) =>
              setExpanded((old) => (typeof updater === "function" ? updater(old) : updater))
            }
            actions={actions}
          />
          <p className="mt-4 border-t border-border pt-3 text-label text-ink-2">
            {data.length} {data.length === 1 ? "marketplace" : "marketplaces"} ·{" "}
            {tab === "locations"
              ? `${totals.locations.toLocaleString("en")} locations`
              : `${totals.amenities.toLocaleString("en")} amenities`}
          </p>
        </div>
      )}

      {open?.form === "marketplace" ? (
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
