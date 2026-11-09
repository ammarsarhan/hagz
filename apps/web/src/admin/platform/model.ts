"use client";

import type { AdminAmenity, AdminLocation, AdminMarketplace } from "@hagz/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/admin/api";
import { message, send } from "@/admin/errors";

// The Platform pages' data, with no design: what's loaded, how it nests, and what the pages can do
// with it. The list page shows the marketplaces; a marketplace's page shows its locations and
// amenities. The views render the data and call `actions`; the dialogs read `open`.

export interface Loaded {
  marketplace: AdminMarketplace;
  locations: AdminLocation[];
  amenities: AdminAmenity[];
}

// A marketplace's location tree: children under their parents, each level by name.
export interface LocationNode {
  location: AdminLocation;
  children: LocationNode[];
}

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

export const byName = (a: { names: { en: string } }, b: { names: { en: string } }) =>
  a.names.en.localeCompare(b.names.en, "en");

export const locationTree = (locations: AdminLocation[]): LocationNode[] => {
  const children = new Map<string | null, AdminLocation[]>();
  for (const location of locations) {
    const siblings = children.get(location.parentId) ?? [];
    siblings.push(location);
    children.set(location.parentId, siblings);
  }
  const build = (parentId: string | null): LocationNode[] =>
    (children.get(parentId) ?? [])
      .sort(byName)
      .map((location) => ({ location, children: build(location.id) }));
  return build(null);
};

// Which form is open, with what it needs.
export type Open =
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

// Everything a marketplace's page can ask for.
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

// The list page: every marketplace with its counts. Nothing under them is fetched here.
export function useMarketplaces() {
  const [marketplaces, setMarketplaces] = useState<AdminMarketplace[]>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const result = await send(api.GET("/v1/admin/marketplaces"));
    if (!result.ok) return setError(message(result.error));
    setError(undefined);
    setMarketplaces([...result.data.data].sort(byName));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { marketplaces, error, reload: () => void load() };
}

// One marketplace's page. The API has no single-marketplace read, so it's found in the list, then
// its locations and amenities are fetched. `missing` is a link to a marketplace that isn't there.
export function useMarketplace(id: string) {
  const [data, setData] = useState<Loaded>();
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<Open>();

  const load = useCallback(async () => {
    const list = await send(api.GET("/v1/admin/marketplaces"));
    if (!list.ok) return setError(message(list.error));
    const marketplace = list.data.data.find((item) => item.id === id);
    if (!marketplace) return setMissing(true);

    const path = { params: { path: { id } } };
    const [locations, amenities] = await Promise.all([
      send(api.GET("/v1/admin/marketplaces/{id}/locations", path)),
      send(api.GET("/v1/admin/marketplaces/{id}/amenities", path)),
    ]);
    if (!locations.ok) return setError(message(locations.error));
    if (!amenities.ok) return setError(message(amenities.error));
    setError(undefined);
    setData({ marketplace, locations: locations.data.data, amenities: amenities.data.data });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return {
    data,
    missing,
    error,
    open,
    actions,
    close: () => setOpen(undefined),
    reload: () => void load(),
  };
}
