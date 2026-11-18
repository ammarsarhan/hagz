"use client";

import type { components } from "@hagz/api";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's Application tab's data (the API calls it the venue's overview), with no design: where
// it is on its way to live (the owner's checklist, the review, what going live still needs, the tax
// number's check), fetched when the tab opens and again after each review step.

export type VenueOverview = components["schemas"]["AdminVenueOverview"];
type SetupKey = VenueOverview["setup"]["items"][number]["key"];
type GoLiveGap = VenueOverview["goLive"][number];

export function useVenueOverview(venueId: string) {
  const [data, setData] = useState<VenueOverview>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/venues/{id}/overview", { params: { path: { id: venueId } } }),
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

// The owner's checklist items, named as the dashboard app names them.
export const setupLabel: Record<SetupKey, string> = {
  DETAILS: "Details",
  LOCATION: "Location",
  PHOTOS: "Photos",
  GROUNDS: "Grounds and prices",
  SCHEDULES: "Opening hours",
  LAYOUT: "Layout",
  SETTINGS: "Policy",
  AMENITIES: "Amenities",
  TAX_NUMBER: "Tax number",
};

export const goLiveLabel: Record<GoLiveGap, string> = {
  AR_TRANSLATION: "Arabic listing",
  EN_TRANSLATION: "English listing",
  ACTIVE_GROUND: "An open ground",
};

export const GO_LIVE_NEEDS: GoLiveGap[] = ["EN_TRANSLATION", "AR_TRANSLATION", "ACTIVE_GROUND"];
