"use client";

import type { VenueTranslation } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's name, description and address in each language, for its Details tab.

export function useVenueTranslations(venueId: string) {
  const [data, setData] = useState<VenueTranslation[]>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/venues/{id}/translations", { params: { path: { id: venueId } } }),
    );
    if (!result.ok) {
      const text = message(result.error);
      setError(text);
      if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setData(result.data.data);
  }, [venueId, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, reload: () => void load() };
}
