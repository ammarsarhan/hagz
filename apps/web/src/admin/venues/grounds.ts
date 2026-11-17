"use client";

import type {
  AdminVenueGrounds,
  GroundEnvironment,
  GroundSize,
  GroundSport,
  GroundSurface,
  PriceTier,
  ScheduleDay,
} from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's Grounds tab's data: its grounds with their weekly hours, its layout, and the currency
// of their prices, with the words each value reads as.

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

  return { data, error };
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

export const tierLabel: Record<PriceTier, string> = {
  BASE: "Base",
  PEAK: "Peak",
  DISCOUNT: "Discount",
};

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "7 pm", "12 am", "11 am": the start of an hour.
const hourLabel = (hour: number) =>
  `${String(hour % 12 === 0 ? 12 : hour % 12)} ${hour < 12 || hour === 24 ? "am" : "pm"}`;

// A day's open hours as runs of one tier: 19–20 BASE and 20–22 PEAK are two runs. An hour is its
// start, so a run ends an hour after its last one.
export const runsOf = (day: ScheduleDay) => {
  const hours = [...day.hours].sort((a, b) => a.hour - b.hour);
  const runs: { from: number; to: number; tier: PriceTier }[] = [];
  for (const { hour, tier } of hours) {
    const last = runs.at(-1);
    if (last && last.to === hour && last.tier === tier) last.to = hour + 1;
    else runs.push({ from: hour, to: hour + 1, tier });
  }
  return runs.map((run) => ({
    ...run,
    label: `${hourLabel(run.from)} – ${hourLabel(run.to)}`,
  }));
};
