import type { TFunction } from "i18next";
import {
  CANCELLATION_PRESETS,
  DEPOSIT_PERCENT,
  MAXIMUM_CANCELLATION_TIERS,
  NOTICE_CHOICES,
  type CancellationPolicy,
  type CancellationTier,
  type MinimumNotice,
  type PaymentMode,
} from "@hagz/contracts";

// The words and rules behind the "Payments and cancellations" screens (app/setup/[venueId]/settings).
// The values themselves (notice choices, presets, tier limits) come from @hagz/contracts, so the
// app and the API agree on them.
export { DEPOSIT_PERCENT, MAXIMUM_CANCELLATION_TIERS, NOTICE_CHOICES };
export type { CancellationPolicy, CancellationTier, MinimumNotice, PaymentMode };

export const POLICIES = ["FLEXIBLE", "MODERATE", "STRICT", "CUSTOM"] as const;
export const PAYMENT_MODES = ["MANUAL", "DEPOSIT", "PLATFORM"] as const;

// What turning loyalty on starts with (Figma 326:2's "Every 6th booking free, within 60 days").
export const DEFAULT_LOYALTY = { stamps: 6, windowDays: 60 };
// The API's limits on which booking is free (Loyalty.stamps), and the windows offered for how long
// bookings count: a few round lengths rather than any day from 1 to 365.
export const LOYALTY_STAMPS = { min: 2, max: 20 };
export const LOYALTY_WINDOWS = [30, 60, 90, 180, 365] as const;

// The API's limits on a custom rule (CancellationTier).
export const MAXIMUM_NOTICE_HOURS = 336;

// "1 hour before kick-off", "30 minutes before kick-off", "1 day before kick-off".
export const noticeLabel = (t: TFunction, minutes: MinimumNotice) => {
  if (minutes === 0) return t("screens.setup.settings.notice.none");
  if (minutes < 60) return t("screens.setup.settings.notice.minutes", { count: minutes });
  if (minutes === 1440) return t("screens.setup.settings.notice.day");
  return t("screens.setup.settings.notice.hours", { count: minutes / 60 });
};

export const paymentLabel = (t: TFunction, mode: PaymentMode) =>
  t(`screens.setup.settings.payment.modes.${mode}.title`);

// What choosing "Deposit online" starts with when the venue has no share saved: the least allowed.
export const DEFAULT_DEPOSIT_PERCENT = DEPOSIT_PERCENT.min;

// A policy's rules: the preset's, or the owner's own.
export const tiersOf = (
  policy: CancellationPolicy,
  custom: readonly CancellationTier[] | null,
): CancellationTier[] =>
  policy === "CUSTOM"
    ? [...(custom ?? [])]
    : CANCELLATION_PRESETS[policy].map((tier) => ({ ...tier }));

export const sameTiers = (a: readonly CancellationTier[], b: readonly CancellationTier[]) =>
  a.length === b.length &&
  a.every((tier, i) => tier.hours === b[i]?.hours && tier.refundPercent === b[i]?.refundPercent);

// The refund table players see (Figma "Cancellation · 3 Confirm", 332:2): one line per rule, from
// the most notice to the least, then whatever's left with less notice than the last rule.
export const refundRows = (t: TFunction, tiers: readonly CancellationTier[]) => {
  const rows = tiers.map((tier, i) => {
    const before = tiers[i - 1];
    return {
      key: `${tier.hours}`,
      when: before
        ? t("screens.setup.settings.cancellation.between", {
            from: tier.hours,
            count: before.hours,
          })
        : t("screens.setup.settings.cancellation.orMore", { count: tier.hours }),
      refund: tier.refundPercent,
    };
  });
  const last = tiers[tiers.length - 1];
  if (last && last.refundPercent > 0) {
    rows.push({
      key: "rest",
      when: t("screens.setup.settings.cancellation.lessThan", { count: last.hours }),
      refund: 0,
    });
  }
  return rows;
};

// The rule added under the last one: half its notice and half its refund, so it already fits.
export const nextTier = (last: CancellationTier | undefined): CancellationTier => ({
  hours: Math.max(1, Math.floor((last?.hours ?? 2) / 2)),
  refundPercent: Math.floor((last?.refundPercent ?? 100) / 2),
});
