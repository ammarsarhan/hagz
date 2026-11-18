"use client";

import type {
  AdminVenueGrounds,
  GroundEnvironment,
  GroundSize,
  GroundSport,
  GroundSurface,
} from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's Grounds tab's data: its grounds, its layout, and the currency of their prices, with the
// words a ground's values read as.

export type AdminGround = AdminVenueGrounds["grounds"][number];

export function useVenueGrounds(venueId: string) {
  const [data, setData] = useState<AdminVenueGrounds>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/venues/{id}/grounds", { params: { path: { id: venueId } } }),
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

  return { data, error, reload: load };
}

export const sportLabel: Record<GroundSport, string> = {
  FOOTBALL: "Football",
  PADEL: "Padel",
  TENNIS: "Tennis",
  BASKETBALL: "Basketball",
  VOLLEYBALL: "Volleyball",
};

export const sizeLabel: Record<GroundSize, string> = {
  FIVE_A_SIDE: "5-a-side",
  SEVEN_A_SIDE: "7-a-side",
  ELEVEN_A_SIDE: "11-a-side",
  STANDARD: "Standard",
};

export const surfaceLabel: Record<GroundSurface, string> = {
  NATURAL_GRASS: "Natural grass",
  ARTIFICIAL_TURF: "Artificial turf",
  HARD_WOOD: "Hardwood",
  HARD_COURT: "Hard court",
  CLAY: "Clay",
  SAND: "Sand",
  OTHER: "Other",
};

export const environmentLabel: Record<GroundEnvironment, string> = {
  INDOOR: "Indoor",
  OUTDOOR: "Outdoor",
  COVERED: "Covered",
};
