import { describe, expect, it } from "vitest";
import {
  checkScheduleAgainstPrices,
  fromStoredHours,
  mergeGround,
  toStoredHours,
  type GroundFields,
} from "@/modules/venues/domain/grounds";

const pitch: GroundFields = {
  sport: "FOOTBALL",
  size: "FIVE_A_SIDE",
  surface: "ARTIFICIAL_TURF",
  environment: "OUTDOOR",
  basePrice: 60000,
  peakPrice: 80000,
  discountPrice: null,
  minimumSlots: 1,
  maximumSlots: 3,
};

const failure = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a failure");
};

describe("changing a ground", () => {
  it("changes only what's sent", () => {
    expect(mergeGround(pitch, { basePrice: 70000 }, new Set())).toEqual({
      ...pitch,
      basePrice: 70000,
    });
  });

  it("keeps sizes to the ones a sport comes in", () => {
    expect(failure(() => mergeGround(pitch, { sport: "PADEL" }, new Set()))).toMatchObject({
      code: "INVALID_GROUND",
      extensions: { field: "size" },
    });
    expect(mergeGround(pitch, { sport: "PADEL", size: "STANDARD" }, new Set()).sport).toBe("PADEL");
  });

  it("keeps the shortest booking within the longest", () => {
    expect(failure(() => mergeGround(pitch, { minimumSlots: 4 }, new Set()))).toMatchObject({
      extensions: { field: "minimumSlots" },
    });
  });

  it("won't drop a price the week still uses", () => {
    expect(failure(() => mergeGround(pitch, { peakPrice: null }, new Set(["PEAK"])))).toMatchObject(
      {
        extensions: { field: "peakPrice" },
      },
    );
    expect(mergeGround(pitch, { peakPrice: null }, new Set(["BASE"])).peakPrice).toBeNull();
  });
});

describe("weekly hours", () => {
  it("need a price for each tier they use", () => {
    const evening = [{ dayOfWeek: 4, hours: [{ hour: 19, tier: "PEAK" as const }] }];
    expect(() => {
      checkScheduleAgainstPrices(evening, pitch);
    }).not.toThrow();
    const quiet = [{ dayOfWeek: 4, hours: [{ hour: 16, tier: "DISCOUNT" as const }] }];
    expect(
      failure(() => {
        checkScheduleAgainstPrices(quiet, pitch);
      }),
    ).toMatchObject({
      code: "SCHEDULE_TIER_WITHOUT_PRICE",
      extensions: { tier: "DISCOUNT" },
    });
  });

  it("are stored as an hour → tier map and read back in order", () => {
    const day = {
      dayOfWeek: 4,
      hours: [
        { hour: 23, tier: "PEAK" as const },
        { hour: 16, tier: "DISCOUNT" as const },
        { hour: 17, tier: "BASE" as const },
      ],
    };
    const stored = toStoredHours(day);
    expect(stored).toEqual({ "16": "DISCOUNT", "17": "BASE", "23": "PEAK" });
    expect(fromStoredHours(4, stored).hours.map((h) => h.hour)).toEqual([16, 17, 23]);
  });
});
