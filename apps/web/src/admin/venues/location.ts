"use client";

import type { AdminVenueLocation, Coordinates } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's pin and area, for the Location section of its Details.

export function useVenueLocation(venueId: string) {
  const [data, setData] = useState<AdminVenueLocation>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/venues/{id}/location", { params: { path: { id: venueId } } }),
    );
    if (!result.ok) {
      const text = message(result.error);
      setError(text);
      if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setData(result.data);
  }, [venueId, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, reload: () => void load() };
}

const EARTH_METRES = 6_371_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

// How far apart two points are along the ground (haversine), in metres. Close enough to rank areas
// by; the API measures the real limit in PostGIS.
export const metresBetween = (a: Coordinates, b: Coordinates) => {
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_METRES * Math.asin(Math.sqrt(h));
};

// "850 m", "2.4 km", "36 km".
export const formatDistance = (metres: number) =>
  metres < 1000
    ? `${String(Math.round(metres / 10) * 10)} m`
    : `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
