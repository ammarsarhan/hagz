"use client";

import type { AdminVenueContact } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's phone and tax number with its latest check, for the Contact and tax section of its
// Details.

export function useVenueContact(venueId: string) {
  const [data, setData] = useState<AdminVenueContact>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/venues/{id}/contact", { params: { path: { id: venueId } } }),
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
