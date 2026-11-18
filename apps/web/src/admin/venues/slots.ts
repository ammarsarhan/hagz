"use client";

import type { VenueSlots } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's Slots tab's data: one local day of its slots. No date opens on today, or the nearest
// day that has slots; the day before stays on screen while the next one loads.

export type AdminSlot = VenueSlots["slots"][number];

export function useVenueSlots(venueId: string, date: string | undefined) {
  const [data, setData] = useState<VenueSlots>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const hud = useHud();

  const load = useCallback(async () => {
    setLoading(true);
    const result = await send(
      api.GET("/v1/admin/venues/{id}/slots", {
        params: { path: { id: venueId }, query: date ? { date } : {} },
      }),
    );
    setLoading(false);
    if (!result.ok) {
      const text = message(result.error);
      setError(text);
      if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setData(result.data);
  }, [venueId, date, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading };
}

// A local date moved by whole days ("2026-11-19" + 1 → "2026-11-20"), as a calendar date: no
// timezone is involved, so noon UTC keeps it clear of any edge.
export const addDays = (date: string, days: number) => {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

// "Thursday 19 November 2026".
export const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

// The hour of the day (0–23) an instant falls on in a timezone.
export const localHour = (instant: string, timezone: string) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(new Date(instant)),
  );

// "4 pm", "12 am".
export const hourLabel = (hour: number) => {
  const clock = ((hour % 24) + 24) % 24;
  return `${String(clock % 12 === 0 ? 12 : clock % 12)} ${clock < 12 ? "am" : "pm"}`;
};
