import { describe, expect, it } from "vitest";
import {
  depositFor,
  priceBooking,
  serviceFeeFor,
  vatInside,
} from "@/modules/bookings/domain/charges";
import {
  chargesAfterMove,
  depositAfterMove,
  respondBy,
  type StoredCharge,
} from "@/modules/bookings/domain/moves";
import { checkLength, checkRange, coversExactly } from "@/modules/bookings/domain/rules";
import { joinFeeOf } from "@/modules/bookings/domain/listings";
import { canMove, paymentDeadline, startOf } from "@/modules/bookings/domain/status";

// The pure parts of booking (PR 4.1): which ranges can be booked, what they cost, and where a
// booking starts in its state machine.

const at = (iso: string) => new Date(iso);
const hour = (start: string, end: string, id = start) => ({
  id,
  startsAt: at(start),
  endsAt: at(end),
});

describe("coversExactly", () => {
  const from = at("2026-12-01T18:00:00Z");
  const to = at("2026-12-01T20:00:00Z");

  it("accepts back-to-back slots from start to end", () => {
    expect(
      coversExactly(
        [
          hour("2026-12-01T18:00:00Z", "2026-12-01T19:00:00Z"),
          hour("2026-12-01T19:00:00Z", "2026-12-01T20:00:00Z"),
        ],
        from,
        to,
      ),
    ).toBe(true);
  });

  it("refuses a gap, a late start, an overrun and no slots", () => {
    expect(coversExactly([hour("2026-12-01T18:00:00Z", "2026-12-01T19:00:00Z")], from, to)).toBe(
      false,
    );
    expect(coversExactly([hour("2026-12-01T19:00:00Z", "2026-12-01T20:00:00Z")], from, to)).toBe(
      false,
    );
    expect(
      coversExactly(
        [
          hour("2026-12-01T18:00:00Z", "2026-12-01T19:00:00Z"),
          hour("2026-12-01T19:00:00Z", "2026-12-01T20:30:00Z"),
        ],
        from,
        to,
      ),
    ).toBe(false);
    expect(coversExactly([], from, to)).toBe(false);
  });

  it("accepts a manual slot of another length", () => {
    expect(
      coversExactly(
        [hour("2026-12-01T18:00:00Z", "2026-12-01T19:30:00Z")],
        from,
        at("2026-12-01T19:30:00Z"),
      ),
    ).toBe(true);
  });
});

describe("checkRange", () => {
  const now = at("2026-12-01T12:00:00Z");
  const rules = { now, minimumNotice: 60, horizonDays: 90 };

  it("allows a range after the notice and inside the horizon", () => {
    expect(() => {
      checkRange(at("2026-12-01T13:00:00Z"), at("2026-12-01T14:00:00Z"), rules);
    }).not.toThrow();
  });

  it("refuses an empty range, too little notice and past the horizon", () => {
    expect(() => {
      checkRange(at("2026-12-01T14:00:00Z"), at("2026-12-01T14:00:00Z"), rules);
    }).toThrow(expect.objectContaining({ code: "INVALID_BOOKING_TIME" }));
    expect(() => {
      checkRange(at("2026-12-01T12:59:00Z"), at("2026-12-01T13:59:00Z"), rules);
    }).toThrow(expect.objectContaining({ code: "INVALID_BOOKING_TIME" }));
    expect(() => {
      checkRange(at("2027-03-01T11:00:00Z"), at("2027-03-01T13:00:00Z"), rules);
    }).toThrow(expect.objectContaining({ code: "INVALID_BOOKING_TIME" }));
  });
});

describe("checkLength", () => {
  it("keeps to the ground's minimum and maximum", () => {
    expect(() => {
      checkLength(1, 1, 3);
    }).not.toThrow();
    expect(() => {
      checkLength(3, 1, 3);
    }).not.toThrow();
    expect(() => {
      checkLength(1, 2, 3);
    }).toThrow(expect.objectContaining({ extensions: { minimumSlots: 2, maximumSlots: 3 } }));
    expect(() => {
      checkLength(4, 1, 3);
    }).toThrow();
  });
});

describe("charges", () => {
  it("finds the VAT inside a VAT-inclusive amount", () => {
    expect(vatInside(11_400, 1400)).toBe(1400);
    expect(vatInside(50_000, 1400)).toBe(6140); // 6140.35…
    expect(vatInside(50_000, 0)).toBe(0);
  });

  it("charges each slot at its price and amenities per hour or per booking", () => {
    const { lines, total, tax } = priceBooking(
      [
        { startsAt: at("2026-12-01T18:00:00Z"), tier: "BASE", price: 40_000 },
        { startsAt: at("2026-12-01T19:00:00Z"), tier: "PEAK", price: 60_000 },
      ],
      [
        { optionId: "lights", price: 5_000, pricing: "PER_HOUR" },
        { optionId: "ball", price: 2_000, pricing: "PER_BOOKING" },
      ],
      1400,
    );
    expect(lines.map((line) => line.amount)).toEqual([40_000, 60_000, 10_000, 2_000]);
    expect(total).toBe(112_000);
    expect(tax).toBe(lines.reduce((sum, line) => sum + line.taxAmount, 0));
    expect(lines.every((line) => line.taxRate === 1400)).toBe(true);
  });

  it("charges no VAT when the venue has no tax number", () => {
    const { tax, lines } = priceBooking(
      [{ startsAt: at("2026-12-01T18:00:00Z"), tier: "BASE", price: 40_000 }],
      [],
      0,
    );
    expect(tax).toBe(0);
    expect(lines[0]).toMatchObject({ taxRate: 0, taxAmount: 0 });
  });

  it("works out Hagz's service fee per player per hour of the booking", () => {
    expect(serviceFeeFor(10, 100, 120)).toBe(2_000); // 5-a-side, 2 hours: 20 EGP
    expect(serviceFeeFor(14, 100, 60)).toBe(1_400); // 7-a-side, 1 hour: 14 EGP
    expect(serviceFeeFor(10, 100, 90)).toBe(1_500); // an hour and a half
    expect(serviceFeeFor(10, 0, 120)).toBe(0);
  });

  it("adds the service fee as its own line, at the marketplace's VAT whatever the venue's", () => {
    const { lines, total, tax } = priceBooking(
      [{ startsAt: at("2026-12-01T18:00:00Z"), tier: "BASE", price: 40_000 }],
      [],
      0,
      { amount: 1_000, taxRate: 1400 },
    );
    expect(lines.at(-1)).toMatchObject({
      type: "SERVICE_FEE",
      amount: 1_000,
      taxRate: 1400,
      taxAmount: vatInside(1_000, 1400),
    });
    expect(total).toBe(41_000);
    expect(tax).toBe(vatInside(1_000, 1400));
    // None when there's no fee.
    expect(priceBooking([], [], 0, { amount: 0, taxRate: 1400 }).lines).toEqual([]);
  });

  it("rounds a deposit up, at least 1 and at most the total", () => {
    expect(depositFor(10_000, 30)).toBe(3_000);
    expect(depositFor(10_001, 30)).toBe(3_001); // 3000.3 → 3001
    expect(depositFor(1, 10)).toBe(1);
    expect(depositFor(10_000, 100)).toBe(10_000);
  });
});

describe("where a booking starts", () => {
  const now = at("2026-12-01T12:00:00Z");
  const base = {
    autoConfirm: true,
    paymentMode: "MANUAL" as const,
    total: 40_000,
    now,
    startsAt: at("2026-12-03T18:00:00Z"),
    minimumNotice: 60,
    paymentWindow: null,
  };

  it("confirms at once when nothing is due online and no approval is needed", () => {
    expect(startOf(base)).toEqual({ status: "CONFIRMED", expiresAt: null });
    expect(startOf({ ...base, paymentMode: "PLATFORM", total: 0 }).status).toBe("CONFIRMED");
  });

  it("waits for approval for at most 12 hours, or until booking closes", () => {
    expect(startOf({ ...base, autoConfirm: false })).toEqual({
      status: "PENDING",
      expiresAt: at("2026-12-02T00:00:00Z"),
    });
    // Kick-off in 5 hours with an hour's notice: approval must come within 4.
    expect(startOf({ ...base, autoConfirm: false, startsAt: at("2026-12-01T17:00:00Z") })).toEqual({
      status: "PENDING",
      expiresAt: at("2026-12-01T16:00:00Z"),
    });
  });

  it("waits for payment within the venue's window, the default, or until kick-off", () => {
    expect(startOf({ ...base, paymentMode: "DEPOSIT" })).toEqual({
      status: "HELD",
      expiresAt: at("2026-12-01T12:15:00Z"),
    });
    expect(startOf({ ...base, paymentMode: "PLATFORM", paymentWindow: 30 }).expiresAt).toEqual(
      at("2026-12-01T12:30:00Z"),
    );
    expect(paymentDeadline(now, at("2026-12-01T12:10:00Z"), 30)).toEqual(
      at("2026-12-01T12:10:00Z"),
    );
  });

  it("allows only the transitions in the table", () => {
    expect(canMove("PENDING", "HELD")).toBe(true);
    expect(canMove("HELD", "CONFIRMED")).toBe(true);
    expect(canMove("CONFIRMED", "PENDING")).toBe(false);
    expect(canMove("EXPIRED", "CONFIRMED")).toBe(false);
  });
});

describe("moving", () => {
  const line = (fields: Partial<StoredCharge>): StoredCharge => ({
    type: "SLOT",
    startsAt: null,
    tier: null,
    optionId: null,
    discountId: null,
    pricing: null,
    amount: 0,
    taxRate: 1400,
    taxAmount: 0,
    ...fields,
  });

  it("prices the new hours, scales per-hour amenities and keeps the rest", () => {
    const charges = [
      line({ startsAt: at("2026-12-01T18:00:00Z"), tier: "BASE", amount: 40_000 }),
      line({ startsAt: at("2026-12-01T19:00:00Z"), tier: "BASE", amount: 40_000 }),
      line({ type: "AMENITY", optionId: "ball", pricing: "PER_HOUR", amount: 10_000 }),
      line({ type: "AMENITY", optionId: "bibs", pricing: "PER_BOOKING", amount: 3_000 }),
    ];
    const slots = [
      { startsAt: at("2026-12-01T20:00:00Z"), tier: "PEAK" as const, price: 60_000 },
      { startsAt: at("2026-12-01T21:00:00Z"), tier: "PEAK" as const, price: 60_000 },
      { startsAt: at("2026-12-01T22:00:00Z"), tier: "PEAK" as const, price: 60_000 },
    ];
    const moved = chargesAfterMove(charges, slots);
    expect(moved.lines.map((charge) => [charge.type, charge.amount])).toEqual([
      ["SLOT", 60_000],
      ["SLOT", 60_000],
      ["SLOT", 60_000],
      ["AMENITY", 15_000],
      ["AMENITY", 3_000],
    ]);
    expect(moved.total).toBe(198_000);
    expect(moved.lines[0]?.taxAmount).toBe(vatInside(60_000, 1400));
  });

  it("keeps a deposit's share of the total", () => {
    expect(depositAfterMove(null, 80_000, 100_000)).toBeNull();
    expect(depositAfterMove(40_000, 80_000, 100_000)).toBe(50_000);
    expect(depositAfterMove(1, 80_000, 10)).toBe(1);
    expect(depositAfterMove(80_000, 80_000, 60_000)).toBe(60_000);
  });

  it("closes the answer 24 hours after the move, or at kick-off if sooner", () => {
    const movedAt = at("2026-12-01T10:00:00Z");
    expect(respondBy(movedAt, at("2026-12-05T18:00:00Z"))).toEqual(at("2026-12-02T10:00:00Z"));
    expect(respondBy(movedAt, at("2026-12-01T18:00:00Z"))).toEqual(at("2026-12-01T18:00:00Z"));
  });
});

describe("joining fee", () => {
  it("is the rate of the share, rounded to a unit", () => {
    expect(joinFeeOf(6_000, 1000, 500)).toBe(600);
    expect(joinFeeOf(12_500, 1000, 500)).toBe(1_300);
  });

  it("is never less than the marketplace's minimum", () => {
    expect(joinFeeOf(4_000, 1000, 500)).toBe(500);
    expect(joinFeeOf(1_000, 1000, 500)).toBe(500);
  });

  it("is off, minimum and all, at a rate of 0", () => {
    expect(joinFeeOf(4_000, 0, 500)).toBe(0);
  });
});
