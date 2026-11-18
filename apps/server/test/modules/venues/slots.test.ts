import type { PriceTier, ScheduleDay } from "@hagz/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  desiredSlots,
  generationWindow,
  HORIZON_DAYS,
  type TierPrices,
} from "@/modules/venues/domain/slots";

// The one definition of which slots a ground should have (PR 2.6). Egypt's clocks in 2026: Friday 24
// April skips 12 am (11 pm is followed by 1 am, UTC+2 → +3), and Thursday 29 October repeats 11 pm
// (UTC+3 → +2).

const CAIRO = "Africa/Cairo";
const prices: TierPrices = { basePrice: 60000, peakPrice: 75000, discountPrice: 45000 };
const day = (dayOfWeek: number, hours: [number, PriceTier][]): ScheduleDay => ({
  dayOfWeek,
  hours: hours.map(([hour, tier]) => ({ hour, tier })),
});
const starts = (slots: { startsAt: Date }[]) => slots.map((slot) => slot.startsAt.toISOString());
const window = (from: string, to: string) => ({ from: new Date(from), to: new Date(to) });

describe("desiredSlots", () => {
  it("makes an hour-long slot at each scheduled local hour, with its tier's price", () => {
    // Thursday 19 November 2026; Cairo is UTC+2 in winter.
    const slots = desiredSlots({
      schedule: [
        day(4, [
          [19, "BASE"],
          [20, "PEAK"],
        ]),
      ],
      prices,
      timezone: CAIRO,
      ...window("2026-11-19T00:00:00Z", "2026-11-20T00:00:00Z"),
    });
    expect(slots).toEqual([
      {
        startsAt: new Date("2026-11-19T17:00:00Z"),
        endsAt: new Date("2026-11-19T18:00:00Z"),
        tier: "BASE",
        price: 60000,
      },
      {
        startsAt: new Date("2026-11-19T18:00:00Z"),
        endsAt: new Date("2026-11-19T19:00:00Z"),
        tier: "PEAK",
        price: 75000,
      },
    ]);
  });

  it("follows the clocks forward: the skipped hour has no slot, the next is an hour later", () => {
    const slots = desiredSlots({
      schedule: [
        day(4, [[23, "BASE"]]),
        day(5, [
          [0, "BASE"],
          [1, "BASE"],
        ]),
      ],
      prices,
      timezone: CAIRO,
      ...window("2026-04-23T00:00:00Z", "2026-04-25T00:00:00Z"),
    });
    // 11 pm on the 23rd (UTC+2), then 1 am on the 24th (UTC+3); 12 am never happens.
    expect(starts(slots)).toEqual(["2026-04-23T21:00:00.000Z", "2026-04-23T22:00:00.000Z"]);
  });

  it("follows the clocks back: the repeated hour has one slot, at its first occurrence", () => {
    const slots = desiredSlots({
      schedule: [
        day(4, [
          [22, "PEAK"],
          [23, "BASE"],
        ]),
        day(5, [[0, "BASE"]]),
      ],
      prices,
      timezone: CAIRO,
      ...window("2026-10-29T00:00:00Z", "2026-10-31T00:00:00Z"),
    });
    // 10 pm and the first 11 pm at UTC+3; 12 am on the 30th at UTC+2, after the second 11 pm.
    expect(starts(slots)).toEqual([
      "2026-10-29T19:00:00.000Z",
      "2026-10-29T20:00:00.000Z",
      "2026-10-29T22:00:00.000Z",
    ]);
  });

  it("carries a late night on: hours past midnight are in the next day's row", () => {
    const slots = desiredSlots({
      schedule: [
        day(4, [[23, "BASE"]]),
        day(5, [
          [0, "BASE"],
          [1, "BASE"],
        ]),
      ],
      prices,
      timezone: CAIRO,
      ...window("2026-11-19T00:00:00Z", "2026-11-21T00:00:00Z"),
    });
    expect(starts(slots)).toEqual([
      "2026-11-19T21:00:00.000Z",
      "2026-11-19T22:00:00.000Z",
      "2026-11-19T23:00:00.000Z",
    ]);
  });

  it("has nothing on closed days", () => {
    const slots = desiredSlots({
      schedule: [day(5, [[19, "BASE"]])],
      prices,
      timezone: CAIRO,
      // Thursday only.
      ...window("2026-11-18T22:00:00Z", "2026-11-19T22:00:00Z"),
    });
    expect(slots).toEqual([]);
  });

  it("leaves out an hour whose tier has no price rather than charge the wrong one", () => {
    const slots = desiredSlots({
      schedule: [
        day(4, [
          [19, "BASE"],
          [20, "PEAK"],
          [21, "DISCOUNT"],
        ]),
      ],
      prices: { basePrice: 60000, peakPrice: null, discountPrice: null },
      timezone: CAIRO,
      ...window("2026-11-19T00:00:00Z", "2026-11-20T00:00:00Z"),
    });
    expect(slots.map((slot) => slot.tier)).toEqual(["BASE"]);
  });

  it("keeps only slots starting inside the window, so one already started isn't made", () => {
    const slots = desiredSlots({
      schedule: [
        day(4, [
          [19, "BASE"],
          [20, "BASE"],
          [21, "BASE"],
        ]),
      ],
      prices,
      timezone: CAIRO,
      // From 7:30 pm to 9 pm local.
      ...window("2026-11-19T17:30:00Z", "2026-11-19T19:00:00Z"),
    });
    expect(starts(slots)).toEqual(["2026-11-19T18:00:00.000Z"]);
  });

  // Whole-hour zones, with and without DST, ahead of and behind UTC.
  const zones = ["Africa/Cairo", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"];
  const schedules = fc
    .array(
      fc.record({
        dayOfWeek: fc.integer({ min: 0, max: 6 }),
        hour: fc.integer({ min: 0, max: 23 }),
        tier: fc.constantFrom<PriceTier>("BASE", "PEAK", "DISCOUNT"),
      }),
      { maxLength: 60 },
    )
    .map((hours) => {
      const days = new Map<number, Map<number, PriceTier>>();
      for (const { dayOfWeek, hour, tier } of hours) {
        const row = days.get(dayOfWeek) ?? new Map<number, PriceTier>();
        row.set(hour, tier);
        days.set(dayOfWeek, row);
      }
      return [...days].map(([dayOfWeek, row]) =>
        day(
          dayOfWeek,
          [...row].sort((a, b) => a[0] - b[0]),
        ),
      );
    });
  const anyPrices = fc.record({
    basePrice: fc.integer({ min: 1, max: 100_000_00 }),
    peakPrice: fc.option(fc.integer({ min: 1, max: 100_000_00 }), { nil: null }),
    discountPrice: fc.option(fc.integer({ min: 1, max: 100_000_00 }), { nil: null }),
  });
  // Half the windows start within three days of a real clock change, so the edges get tested.
  const changes = [
    "2026-04-23T22:00:00Z", // Cairo forward
    "2026-10-29T21:00:00Z", // Cairo back
    "2026-03-29T01:00:00Z", // London forward
    "2026-10-25T01:00:00Z", // London back
    "2026-03-08T07:00:00Z", // New York forward
    "2026-11-01T06:00:00Z", // New York back
  ].map((iso) => Date.parse(iso) / 60_000);
  const windows = fc
    .record({
      from: fc.oneof(
        // Any minute from 2025 to 2028.
        fc.integer({ min: Date.UTC(2025, 0, 1) / 60_000, max: Date.UTC(2028, 0, 1) / 60_000 }),
        fc
          .tuple(fc.constantFrom(...changes), fc.integer({ min: -3 * 24 * 60, max: 0 }))
          .map(([change, before]) => change + before),
      ),
      minutes: fc.oneof(
        fc.integer({ min: 0, max: 7 * 24 * 60 }),
        fc.integer({ min: 0, max: (HORIZON_DAYS + 10) * 24 * 60 }),
      ),
    })
    .map(({ from, minutes }) => ({
      from: new Date(from * 60_000),
      to: new Date((from + minutes) * 60_000),
    }));

  // The obvious, slow way: every whole UTC hour in the window whose local time is a scheduled hour
  // on the hour, each local date and hour once.
  const bruteForce = (
    schedule: ScheduleDay[],
    tierPrices: TierPrices,
    timezone: string,
    from: Date,
    to: Date,
  ) => {
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23",
    });
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const expected: { startsAt: string; tier: PriceTier; price: number }[] = [];
    const seen = new Set<string>();
    // From a few hours early, so a repeated hour whose first occurrence was before the window
    // counts as had (its slot already started) and its second isn't taken for it.
    const first = Math.ceil(from.getTime() / 3_600_000) * 3_600_000 - 3 * 3_600_000;
    for (let at = first; at < to.getTime(); at += 3_600_000) {
      const parts = Object.fromEntries(
        format.formatToParts(new Date(at)).map((part) => [part.type, part.value]),
      );
      if (parts.minute !== "00") continue;
      const local = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}`;
      if (seen.has(local)) continue;
      seen.add(local);
      if (at < from.getTime()) continue;
      const hours = schedule.find((d) => d.dayOfWeek === weekdays.indexOf(parts.weekday ?? ""));
      const tier = hours?.hours.find((h) => h.hour === Number(parts.hour))?.tier;
      if (!tier) continue;
      const price =
        tier === "BASE"
          ? tierPrices.basePrice
          : tier === "PEAK"
            ? tierPrices.peakPrice
            : tierPrices.discountPrice;
      if (price === null) continue;
      expected.push({ startsAt: new Date(at).toISOString(), tier, price });
    }
    return expected;
  };

  it("matches the slow way exactly, across timezones and clock changes", () => {
    fc.assert(
      fc.property(
        schedules,
        anyPrices,
        fc.constantFrom(...zones),
        windows,
        (schedule, tierPrices, timezone, { from, to }) => {
          const slots = desiredSlots({ schedule, prices: tierPrices, timezone, from, to });
          expect(
            slots.map((slot) => ({
              startsAt: slot.startsAt.toISOString(),
              tier: slot.tier,
              price: slot.price,
            })),
          ).toEqual(bruteForce(schedule, tierPrices, timezone, from, to));
        },
      ),
      { numRuns: 400 },
    );
  });

  it("never makes two slots that share a start or overlap, all inside the window", () => {
    fc.assert(
      fc.property(
        schedules,
        anyPrices,
        fc.constantFrom(...zones),
        windows,
        (schedule, tierPrices, timezone, { from, to }) => {
          const slots = desiredSlots({ schedule, prices: tierPrices, timezone, from, to });
          for (const [i, slot] of slots.entries()) {
            expect(slot.startsAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
            expect(slot.startsAt.getTime()).toBeLessThan(to.getTime());
            expect(slot.endsAt.getTime() - slot.startsAt.getTime()).toBe(3_600_000);
            const before = slots[i - 1];
            if (before)
              expect(slot.startsAt.getTime()).toBeGreaterThanOrEqual(before.endsAt.getTime());
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("gives the same answer every time", () => {
    fc.assert(
      fc.property(schedules, anyPrices, fc.constantFrom(...zones), windows, (...args) => {
        const [schedule, tierPrices, timezone, { from, to }] = args;
        const input = { schedule, prices: tierPrices, timezone, from, to };
        expect(desiredSlots(input)).toEqual(desiredSlots(input));
      }),
      { numRuns: 30 },
    );
  });
});

describe("generationWindow", () => {
  it("runs from now to the horizon, ending on a whole hour inside it", () => {
    const now = new Date("2026-11-19T10:17:42Z");
    const { from, to } = generationWindow(now);
    expect(from).toEqual(now);
    expect(to.getTime() % 3_600_000).toBe(0);
    expect(to.getTime()).toBeLessThanOrEqual(now.getTime() + HORIZON_DAYS * 24 * 3_600_000);
    expect(to.getTime()).toBeGreaterThan(now.getTime() + (HORIZON_DAYS * 24 - 2) * 3_600_000);
  });
});
