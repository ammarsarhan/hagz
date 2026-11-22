import { describe, expect, it } from "vitest";
import { depositFor, priceBooking, vatInside } from "@/modules/bookings/domain/charges";
import { checkLength, checkRange, coversExactly } from "@/modules/bookings/domain/rules";
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
