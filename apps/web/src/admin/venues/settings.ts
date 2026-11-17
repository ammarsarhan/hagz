"use client";

import type {
  AdminVenueSettings,
  CancellationPolicy,
  CancellationTier,
  MinimumNotice,
  PaymentMode,
  VenueSettingsView,
} from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's Settings tab's data: Hagz's commission for it and the settings its owner also changes in
// the staff app, with the words each value reads as.

export function useVenueSettings(venueId: string) {
  const [data, setData] = useState<AdminVenueSettings>();
  const [error, setError] = useState<string>();
  const hud = useHud();

  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/venues/{id}/settings", { params: { path: { id: venueId } } }),
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

// Basis points as a percentage: 1000 → "10%", 1250 → "12.5%".
export const percent = (basisPoints: number) =>
  `${(basisPoints / 100).toLocaleString("en", { maximumFractionDigits: 2 })}%`;

export const noticeLabel: Record<MinimumNotice, string> = {
  0: "Up to kick-off",
  30: "30 minutes before",
  60: "1 hour before",
  120: "2 hours before",
  180: "3 hours before",
  360: "6 hours before",
  720: "12 hours before",
  1440: "1 day before",
};

export const paymentModeLabel: Record<PaymentMode, string> = {
  MANUAL: "At the venue",
  DEPOSIT: "A deposit online, the rest at the venue",
  PLATFORM: "All online",
};

export const policyLabel: Record<CancellationPolicy, string> = {
  FLEXIBLE: "Flexible",
  MODERATE: "Moderate",
  STRICT: "Strict",
  CUSTOM: "Custom",
};

// "1 day", "6 hours", "1 hour": a tier's notice.
const notice = (hours: number) =>
  hours % 24 === 0
    ? `${String(hours / 24)} ${hours === 24 ? "day" : "days"}`
    : `${String(hours)} ${hours === 1 ? "hour" : "hours"}`;

// "100% back up to 1 day before": one line per tier, then what's left.
export const tierLines = (tiers: CancellationTier[]) => [
  ...tiers.map(
    (tier) => `${String(tier.refundPercent)}% back up to ${notice(tier.hours)} before kick-off`,
  ),
  "Nothing back after that",
];

// "A free booking after every 10, stamps last 90 days", or "Off".
export const loyaltyLabel = (loyalty: VenueSettingsView["loyalty"]) =>
  loyalty
    ? `A free booking after every ${String(loyalty.stamps)}, stamps last ${String(loyalty.windowDays)} days`
    : "Off";
