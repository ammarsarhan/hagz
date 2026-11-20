import { CANCELLATION_PRESETS, refundBands } from "@hagz/contracts";
import { describe, expect, it } from "vitest";
import { cancellationSummary } from "@/modules/venues/domain/cancellation-summary";

// The venue page's plain-words cancellation policy (PR 3.2).

describe("refundBands", () => {
  it("splits the notice into a band per tier and one under the last", () => {
    expect(refundBands(CANCELLATION_PRESETS.MODERATE)).toEqual([
      { from: 24, to: null, refundPercent: 100 },
      { from: 6, to: 24, refundPercent: 50 },
      { from: 0, to: 6, refundPercent: 0 },
    ]);
  });

  it("merges neighbouring bands that refund the same", () => {
    expect(
      refundBands([
        { hours: 72, refundPercent: 50 },
        { hours: 24, refundPercent: 50 },
        { hours: 6, refundPercent: 0 },
      ]),
    ).toEqual([
      { from: 24, to: null, refundPercent: 50 },
      { from: 0, to: 24, refundPercent: 0 },
    ]);
  });

  it("is one band when nothing is ever refunded", () => {
    expect(refundBands([{ hours: 48, refundPercent: 0 }])).toEqual([
      { from: 0, to: null, refundPercent: 0 },
    ]);
  });
});

describe("cancellationSummary", () => {
  it("says each preset in English", () => {
    expect(cancellationSummary(CANCELLATION_PRESETS.FLEXIBLE, "EN")).toEqual([
      "Free cancellation up to 2 hours before it starts.",
      "No refund if you cancel less than 2 hours before it starts.",
      "If the venue cancels, you get a full refund.",
    ]);
    expect(cancellationSummary(CANCELLATION_PRESETS.MODERATE, "EN")).toEqual([
      "Free cancellation up to 24 hours before it starts.",
      "50% back if you cancel 6 to 24 hours before it starts.",
      "No refund if you cancel less than 6 hours before it starts.",
      "If the venue cancels, you get a full refund.",
    ]);
    expect(cancellationSummary(CANCELLATION_PRESETS.STRICT, "EN")).toEqual([
      "50% back if you cancel 48 hours or more before it starts.",
      "No refund if you cancel less than 48 hours before it starts.",
      "If the venue cancels, you get a full refund.",
    ]);
  });

  it("says a preset in Arabic, counting hours the Arabic way", () => {
    expect(cancellationSummary(CANCELLATION_PRESETS.MODERATE, "AR")).toEqual([
      "إلغاء مجاني حتى 24 ساعة قبل الموعد.",
      "استرداد 50% عند الإلغاء بين 6 ساعات و24 ساعة قبل الموعد.",
      "لا استرداد عند الإلغاء قبل الموعد بأقل من 6 ساعات.",
      "إذا ألغى الملعب حجزك، تسترد المبلغ كاملًا.",
    ]);
    expect(cancellationSummary([{ hours: 2, refundPercent: 100 }], "AR")[0]).toBe(
      "إلغاء مجاني حتى ساعتين قبل الموعد.",
    );
    expect(cancellationSummary([{ hours: 1, refundPercent: 100 }], "AR")[0]).toBe(
      "إلغاء مجاني حتى ساعة واحدة قبل الموعد.",
    );
  });

  it("says one hour in the singular", () => {
    expect(cancellationSummary([{ hours: 1, refundPercent: 100 }], "EN")).toEqual([
      "Free cancellation up to 1 hour before it starts.",
      "No refund if you cancel less than 1 hour before it starts.",
      "If the venue cancels, you get a full refund.",
    ]);
  });

  it("says when nothing is ever refunded, in one line", () => {
    expect(cancellationSummary([{ hours: 24, refundPercent: 0 }], "EN")).toEqual([
      "No refunds once booked.",
      "If the venue cancels, you get a full refund.",
    ]);
  });
});
