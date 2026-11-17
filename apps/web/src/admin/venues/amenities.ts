"use client";

import type { AdminVenueAmenities, AmenityPricing } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// What a venue offers, for the Amenities section of its Details.

export function useVenueAmenities(venueId: string) {
  const [data, setData] = useState<AdminVenueAmenities>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/venues/{id}/amenities", { params: { path: { id: venueId } } }),
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

  return { data, error };
}

// Per hour shows as "/hr"; per booking is the plain price, the way a booking is charged.
const PER: Record<AmenityPricing, string> = { PER_HOUR: "/hr", PER_BOOKING: "" };

// "EGP 50" (per booking), "AED 12.50/hr", "Free": a price in the currency's minor units. The
// currency's own decimals (2 for EGP, 3 for KWD) say how many minor units make one, and whole
// amounts drop them.
export const formatAmenityPrice = (
  currency: string,
  price: number | null,
  pricing: AmenityPricing | null,
) => {
  if (price === null || pricing === null) return "Free";
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits;
  const amount = price / 10 ** (digits ?? 2);
  const text = new Intl.NumberFormat("en", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : (digits ?? 2),
    maximumFractionDigits: digits ?? 2,
  }).format(amount);
  return `${currency} ${text}${PER[pricing]}`;
};
