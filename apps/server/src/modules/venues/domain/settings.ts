import {
  CANCELLATION_PRESETS,
  NOTICE_CHOICES,
  type CancellationTier,
  type MinimumNotice,
  type UpdateVenueSettings,
  type VenueSettingsView,
} from "@hagz/contracts";
import { AppError } from "@/platform/errors/app-error";

// A venue's settings as stored (VenueSettings), for the fields the setup screens edit.
export interface StoredSettings {
  autoConfirm: boolean;
  minimumNotice: number;
  paymentMode: VenueSettingsView["paymentMode"];
  depositPercent: number | null;
  cancellationPolicy: VenueSettingsView["cancellationPolicy"];
  cancellationTiers: CancellationTier[] | null;
  loyaltyStamps: number | null;
  loyaltyWindow: number | null;
}

export const invalidSettings = (field: string, detail: string) =>
  new AppError({ code: "INVALID_SETTINGS", status: 422, detail, extensions: { field } });

// Applies a partial change and checks the result as a whole, the way the database CHECKs will:
// DEPOSIT carries a percentage and CUSTOM its tiers, and neither outlives a switch away. Pure, so
// every combination is unit-tested.
export const mergeSettings = (
  current: StoredSettings,
  change: UpdateVenueSettings,
): StoredSettings => {
  const paymentMode = change.paymentMode ?? current.paymentMode;
  let depositPercent =
    change.depositPercent === undefined ? current.depositPercent : change.depositPercent;
  if (paymentMode === "DEPOSIT") {
    if (depositPercent === null) {
      throw invalidSettings("depositPercent", "A deposit needs the share players pay online.");
    }
  } else {
    if (change.depositPercent != null) {
      throw invalidSettings("depositPercent", "Only a deposit has a percentage.");
    }
    depositPercent = null;
  }

  const cancellationPolicy = change.cancellationPolicy ?? current.cancellationPolicy;
  let cancellationTiers =
    change.cancellationTiers === undefined ? current.cancellationTiers : change.cancellationTiers;
  if (cancellationPolicy === "CUSTOM") {
    if (cancellationTiers === null) {
      throw invalidSettings("cancellationTiers", "Your own policy needs at least one rule.");
    }
  } else {
    if (change.cancellationTiers != null) {
      throw invalidSettings("cancellationTiers", "Only your own policy has its own rules.");
    }
    cancellationTiers = null;
  }

  const loyalty =
    change.loyalty === undefined
      ? { loyaltyStamps: current.loyaltyStamps, loyaltyWindow: current.loyaltyWindow }
      : change.loyalty === null
        ? { loyaltyStamps: null, loyaltyWindow: null }
        : { loyaltyStamps: change.loyalty.stamps, loyaltyWindow: change.loyalty.windowDays };

  return {
    autoConfirm: change.autoConfirm ?? current.autoConfirm,
    minimumNotice: change.minimumNotice ?? current.minimumNotice,
    paymentMode,
    depositPercent,
    cancellationPolicy,
    cancellationTiers,
    ...loyalty,
  };
};

// The tiers players are held to: a preset's, or the venue's own.
export const resolvedTiers = (
  policy: StoredSettings["cancellationPolicy"],
  tiers: CancellationTier[] | null,
): CancellationTier[] | null => {
  if (policy === null) return null;
  if (policy === "CUSTOM") return tiers;
  return CANCELLATION_PRESETS[policy].map((tier) => ({ ...tier }));
};

const isNoticeChoice = (minutes: number): minutes is MinimumNotice =>
  (NOTICE_CHOICES as readonly number[]).includes(minutes);

export const settingsView = (stored: StoredSettings): VenueSettingsView => ({
  autoConfirm: stored.autoConfirm,
  // Only the fixed choices are ever written; anything else predates them and shows as the default.
  minimumNotice: isNoticeChoice(stored.minimumNotice) ? stored.minimumNotice : 60,
  paymentMode: stored.paymentMode,
  depositPercent: stored.depositPercent,
  cancellationPolicy: stored.cancellationPolicy,
  cancellationTiers: resolvedTiers(stored.cancellationPolicy, stored.cancellationTiers),
  loyalty:
    stored.loyaltyStamps === null || stored.loyaltyWindow === null
      ? null
      : { stamps: stored.loyaltyStamps, windowDays: stored.loyaltyWindow },
});

// The fields that differ, as { field: [previous, next] }, for the VENUE_SETTINGS_CHANGED event.
export const changedSettings = (previous: StoredSettings, next: StoredSettings) => {
  const changes: Record<string, { previous: unknown; next: unknown }> = {};
  for (const key of Object.keys(next) as (keyof StoredSettings)[]) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      changes[key] = { previous: previous[key], next: next[key] };
    }
  }
  return changes;
};
