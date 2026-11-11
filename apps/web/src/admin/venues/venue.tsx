"use client";

import type { AdminVenue } from "@hagz/contracts";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, problemCode, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// The venue a sub-dashboard is about: fetched once by its layout and shared with every section, so
// moving between sections doesn't fetch it again.

interface CurrentVenue {
  venue?: AdminVenue;
  // A link to a venue that isn't there.
  missing: boolean;
  error?: string;
  reload: () => void;
}

const VenueContext = createContext<CurrentVenue | null>(null);

export function VenueProvider({ venueId, children }: { venueId: string; children: ReactNode }) {
  const [venue, setVenue] = useState<AdminVenue>();
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/venues/{id}", { params: { path: { id: venueId } } }),
    );
    if (result.ok) {
      setError(undefined);
      setVenue(result.data);
      return;
    }
    // A malformed id fails validation before the lookup; to the admin it's the same dead link.
    const code = problemCode(result.error);
    if (code === "VENUE_NOT_FOUND" || code === "VALIDATION_FAILED") return setMissing(true);
    const text = message(result.error);
    setError(text);
    if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
  }, [venueId, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <VenueContext.Provider value={{ venue, missing, error, reload: () => void load() }}>
      {children}
    </VenueContext.Provider>
  );
}

export function useCurrentVenue() {
  const context = useContext(VenueContext);
  if (!context) throw new Error("useCurrentVenue is used outside a venue's dashboard.");
  return context;
}
