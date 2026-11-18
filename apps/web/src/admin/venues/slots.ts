"use client";

import type { VenueSlots } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's Slots tab's data: a week of its slots from a local day. No date opens on today, or the
// nearest day that has slots; the week before stays on screen while the next one loads.

export type AdminSlot = VenueSlots["slots"][number];

export function useVenueSlots(venueId: string, date: string | undefined, span = 1) {
  const [data, setData] = useState<VenueSlots>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const hud = useHud();

  const load = useCallback(async () => {
    setLoading(true);
    const result = await send(
      api.GET("/v1/admin/venues/{id}/slots", {
        params: { path: { id: venueId }, query: date ? { date, span } : { span } },
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
  }, [venueId, date, span, hud]);

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

// The Sunday a local date's week starts on.
export const weekStart = (date: string) =>
  addDays(date, -new Date(`${date}T12:00:00Z`).getUTCDay());

// Today's local date in a timezone.
export const localToday = (timezone: string, now = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(now));

// The local date an instant falls on in a timezone, and the minutes into that day.
export const localTime = (instant: string | Date, timezone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year ?? ""}-${parts.month ?? ""}-${parts.day ?? ""}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

// "4 pm", "12 am".
export const hourLabel = (hour: number) => {
  const clock = ((hour % 24) + 24) % 24;
  return `${String(clock % 12 === 0 ? 12 : clock % 12)} ${clock < 12 ? "am" : "pm"}`;
};
