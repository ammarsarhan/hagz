import { describe, expect, it } from "vitest";
import {
  changedSettings,
  mergeSettings,
  settingsView,
  type StoredSettings,
} from "@/modules/venues/domain/settings";

// A new venue's settings.
const fresh: StoredSettings = {
  autoConfirm: true,
  minimumNotice: 60,
  paymentMode: "MANUAL",
  depositPercent: null,
  cancellationPolicy: null,
  cancellationTiers: null,
  loyaltyStamps: null,
  loyaltyWindow: null,
};

const OWN = [
  { hours: 24, refundPercent: 100 },
  { hours: 3, refundPercent: 25 },
];

const failure = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a failure");
};

describe("merging a settings change", () => {
  it("changes only what's sent", () => {
    const next = mergeSettings(fresh, { autoConfirm: false, minimumNotice: 120 });
    expect(next).toEqual({ ...fresh, autoConfirm: false, minimumNotice: 120 });
  });

  describe("deposits", () => {
    it("need a percentage", () => {
      expect(failure(() => mergeSettings(fresh, { paymentMode: "DEPOSIT" }))).toMatchObject({
        code: "INVALID_SETTINGS",
        extensions: { field: "depositPercent" },
      });
      expect(mergeSettings(fresh, { paymentMode: "DEPOSIT", depositPercent: 30 })).toMatchObject({
        paymentMode: "DEPOSIT",
        depositPercent: 30,
      });
    });

    it("keep their percentage when something else changes", () => {
      const deposit = { ...fresh, paymentMode: "DEPOSIT" as const, depositPercent: 30 };
      expect(mergeSettings(deposit, { autoConfirm: false }).depositPercent).toBe(30);
    });

    it("drop the percentage when switching to another mode", () => {
      const deposit = { ...fresh, paymentMode: "DEPOSIT" as const, depositPercent: 30 };
      expect(mergeSettings(deposit, { paymentMode: "PLATFORM" })).toMatchObject({
        paymentMode: "PLATFORM",
        depositPercent: null,
      });
    });

    it("refuse a percentage for another mode", () => {
      expect(failure(() => mergeSettings(fresh, { depositPercent: 30 }))).toMatchObject({
        extensions: { field: "depositPercent" },
      });
    });
  });

  describe("cancellation policies", () => {
    it("take a preset without tiers of their own", () => {
      const next = mergeSettings(fresh, { cancellationPolicy: "MODERATE" });
      expect(next).toMatchObject({ cancellationPolicy: "MODERATE", cancellationTiers: null });
    });

    it("need rules for the owner's own policy", () => {
      expect(failure(() => mergeSettings(fresh, { cancellationPolicy: "CUSTOM" }))).toMatchObject({
        extensions: { field: "cancellationTiers" },
      });
      const next = mergeSettings(fresh, { cancellationPolicy: "CUSTOM", cancellationTiers: OWN });
      expect(next.cancellationTiers).toEqual(OWN);
    });

    it("drop the owner's rules when switching to a preset", () => {
      const own = { ...fresh, cancellationPolicy: "CUSTOM" as const, cancellationTiers: OWN };
      expect(mergeSettings(own, { cancellationPolicy: "STRICT" }).cancellationTiers).toBeNull();
    });

    it("refuse rules for a preset", () => {
      const change = { cancellationPolicy: "FLEXIBLE" as const, cancellationTiers: OWN };
      expect(failure(() => mergeSettings(fresh, change))).toMatchObject({
        extensions: { field: "cancellationTiers" },
      });
    });
  });

  it("turns loyalty on and off", () => {
    const on = mergeSettings(fresh, { loyalty: { stamps: 6, windowDays: 60 } });
    expect(on).toMatchObject({ loyaltyStamps: 6, loyaltyWindow: 60 });
    expect(mergeSettings(on, { loyalty: null })).toMatchObject({
      loyaltyStamps: null,
      loyaltyWindow: null,
    });
  });
});

describe("settings as the app sees them", () => {
  it("resolves a preset to its tiers", () => {
    expect(settingsView({ ...fresh, cancellationPolicy: "MODERATE" }).cancellationTiers).toEqual([
      { hours: 24, refundPercent: 100 },
      { hours: 6, refundPercent: 50 },
    ]);
  });

  it("shows the owner's own tiers, and none before a policy is chosen", () => {
    const own = { ...fresh, cancellationPolicy: "CUSTOM" as const, cancellationTiers: OWN };
    expect(settingsView(own).cancellationTiers).toEqual(OWN);
    expect(settingsView(fresh).cancellationTiers).toBeNull();
  });

  it("groups loyalty, or null when it's off", () => {
    expect(settingsView(fresh).loyalty).toBeNull();
    expect(settingsView({ ...fresh, loyaltyStamps: 6, loyaltyWindow: 60 }).loyalty).toEqual({
      stamps: 6,
      windowDays: 60,
    });
  });
});

describe("what changed", () => {
  it("lists only the fields that differ, with both values", () => {
    const next = mergeSettings(fresh, { cancellationPolicy: "STRICT", minimumNotice: 60 });
    expect(changedSettings(fresh, next)).toEqual({
      cancellationPolicy: { previous: null, next: "STRICT" },
    });
  });
});
