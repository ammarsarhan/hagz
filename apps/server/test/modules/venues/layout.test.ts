import type { GroundSize, GroundSport, VenueLayout } from "@hagz/contracts";
import { describe, expect, it } from "vitest";
import { defaultSize, footprintOf, validateLayout } from "@/modules/venues/domain/layout";

const five = { sport: "FOOTBALL" as const, size: "FIVE_A_SIDE" as const };
const seven = { sport: "FOOTBALL" as const, size: "SEVEN_A_SIDE" as const };
const grounds = new Map<string, { sport: GroundSport; size: GroundSize }>([
  ["a", five],
  ["b", seven],
]);

const layout = (overrides: Partial<VenueLayout> = {}): VenueLayout => ({
  columns: 16,
  rows: 19,
  grounds: [
    { groundId: "a", x: 1, y: 1, orientation: "HORIZONTAL" },
    { groundId: "b", x: 1, y: 5, orientation: "HORIZONTAL" },
  ],
  facilities: [{ type: "CAFE", x: 9, y: 5, width: 3, height: 2 }],
  entrances: [{ side: "BOTTOM", offset: 8 }],
  ...overrides,
});

const reason = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { extensions: { reason: string } }).extensions.reason;
  }
  return null;
};

describe("footprints", () => {
  it("are fixed by sport and size, and turn with the orientation", () => {
    expect(footprintOf("FOOTBALL", "SEVEN_A_SIDE", "HORIZONTAL")).toEqual({ width: 6, height: 4 });
    expect(footprintOf("FOOTBALL", "SEVEN_A_SIDE", "VERTICAL")).toEqual({ width: 4, height: 6 });
    expect(footprintOf("PADEL", "STANDARD", "HORIZONTAL")).toEqual({ width: 2, height: 1 });
  });
});

describe("validating a layout", () => {
  it("accepts grounds, facilities and entrances that fit", () => {
    expect(
      reason(() => {
        validateLayout(layout(), grounds);
      }),
    ).toBeNull();
  });

  it("keeps everything inside the grid, so shrinking can't cut tiles off", () => {
    expect(
      reason(() => {
        validateLayout(layout({ columns: 6 }), grounds);
      }),
    ).toBe("OUT_OF_BOUNDS");
    const turned = layout({
      grounds: [{ groundId: "b", x: 0, y: 14, orientation: "VERTICAL" }],
      facilities: [],
    });
    expect(
      reason(() => {
        validateLayout(turned, grounds);
      }),
    ).toBe("OUT_OF_BOUNDS");
  });

  it("refuses overlaps, between grounds and facilities alike", () => {
    const onTop = layout({ facilities: [{ type: "CAFE", x: 2, y: 6, width: 1, height: 1 }] });
    expect(
      reason(() => {
        validateLayout(onTop, grounds);
      }),
    ).toBe("OVERLAP");
    // Touching edges is fine.
    const beside = layout({ facilities: [{ type: "CAFE", x: 7, y: 5, width: 2, height: 2 }] });
    expect(
      reason(() => {
        validateLayout(beside, grounds);
      }),
    ).toBeNull();
  });

  it("only places the venue's grounds, once each", () => {
    const stranger = layout({
      grounds: [{ groundId: "z", x: 0, y: 0, orientation: "HORIZONTAL" }],
    });
    expect(
      reason(() => {
        validateLayout(stranger, grounds);
      }),
    ).toBe("UNKNOWN_GROUND");
    const twice = layout({
      grounds: [
        { groundId: "a", x: 0, y: 0, orientation: "HORIZONTAL" },
        { groundId: "a", x: 0, y: 10, orientation: "HORIZONTAL" },
      ],
      facilities: [],
    });
    expect(
      reason(() => {
        validateLayout(twice, grounds);
      }),
    ).toBe("DUPLICATE_GROUND");
  });

  it("keeps entrances on their side, one per spot", () => {
    const past = layout({ entrances: [{ side: "LEFT", offset: 19 }] });
    expect(
      reason(() => {
        validateLayout(past, grounds);
      }),
    ).toBe("ENTRANCE_OUT_OF_RANGE");
    const same = layout({
      entrances: [
        { side: "TOP", offset: 3 },
        { side: "TOP", offset: 3 },
      ],
    });
    expect(
      reason(() => {
        validateLayout(same, grounds);
      }),
    ).toBe("DUPLICATE_ENTRANCE");
  });
});

describe("a new layout's size", () => {
  it("starts at 16 × 19 and grows to fit an 11-a-side pitch", () => {
    expect(defaultSize([five, seven])).toEqual({ columns: 16, rows: 19 });
    expect(defaultSize([{ sport: "FOOTBALL", size: "ELEVEN_A_SIDE" }])).toEqual({
      columns: 16,
      rows: 19,
    });
  });
});
