import {
  footprintAllowed,
  FOOTPRINT_RANGES,
  FOOTPRINTS,
  type GroundSize,
  type GroundSport,
  type VenueLayout,
} from "@hagz/contracts";
import { describe, expect, it } from "vitest";
import { defaultSize, footprintOf, validateLayout } from "@/modules/venues/domain/layout";

const five = { sport: "FOOTBALL" as const, size: "FIVE_A_SIDE" as const };
const seven = { sport: "FOOTBALL" as const, size: "SEVEN_A_SIDE" as const };
const grounds = new Map<string, { sport: GroundSport; size: GroundSize }>([
  ["a", five],
  ["b", seven],
]);

// The venue's placeable amenities, by option id.
const amenities = new Set(["cafe", "parking"]);

const layout = (overrides: Partial<VenueLayout> = {}): VenueLayout => ({
  columns: 16,
  rows: 19,
  grounds: [
    { groundId: "a", x: 1, y: 1, orientation: "HORIZONTAL", width: 4, height: 2 },
    { groundId: "b", x: 1, y: 5, orientation: "HORIZONTAL", width: 6, height: 4 },
  ],
  amenities: [{ optionId: "cafe", x: 9, y: 5, width: 3, height: 2 }],
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
  it("accepts grounds, amenities and entrances that fit", () => {
    expect(
      reason(() => {
        validateLayout(layout(), grounds, amenities);
      }),
    ).toBeNull();
  });

  it("keeps everything inside the grid, so shrinking can't cut tiles off", () => {
    expect(
      reason(() => {
        validateLayout(layout({ columns: 6 }), grounds, amenities);
      }),
    ).toBe("OUT_OF_BOUNDS");
    const turned = layout({
      grounds: [{ groundId: "b", x: 0, y: 14, orientation: "VERTICAL", width: 6, height: 4 }],
      amenities: [],
    });
    expect(
      reason(() => {
        validateLayout(turned, grounds, amenities);
      }),
    ).toBe("OUT_OF_BOUNDS");
  });

  it("refuses overlaps, between grounds and amenities alike", () => {
    const onTop = layout({ amenities: [{ optionId: "cafe", x: 2, y: 6, width: 1, height: 1 }] });
    expect(
      reason(() => {
        validateLayout(onTop, grounds, amenities);
      }),
    ).toBe("OVERLAP");
    // Touching edges is fine.
    const beside = layout({ amenities: [{ optionId: "cafe", x: 7, y: 5, width: 2, height: 2 }] });
    expect(
      reason(() => {
        validateLayout(beside, grounds, amenities);
      }),
    ).toBeNull();
  });

  it("only places the venue's grounds, once each", () => {
    const stranger = layout({
      grounds: [{ groundId: "z", x: 0, y: 0, orientation: "HORIZONTAL", width: 4, height: 2 }],
    });
    expect(
      reason(() => {
        validateLayout(stranger, grounds, amenities);
      }),
    ).toBe("UNKNOWN_GROUND");
    const twice = layout({
      grounds: [
        { groundId: "a", x: 0, y: 0, orientation: "HORIZONTAL", width: 4, height: 2 },
        { groundId: "a", x: 0, y: 10, orientation: "HORIZONTAL", width: 4, height: 2 },
      ],
      amenities: [],
    });
    expect(
      reason(() => {
        validateLayout(twice, grounds, amenities);
      }),
    ).toBe("DUPLICATE_GROUND");
  });

  it("only places the venue's placeable amenities, as often as it likes", () => {
    const wifi = layout({ amenities: [{ optionId: "wifi", x: 9, y: 5, width: 1, height: 1 }] });
    expect(
      reason(() => {
        validateLayout(wifi, grounds, amenities);
      }),
    ).toBe("UNKNOWN_AMENITY");
    // Two car parks.
    const twice = layout({
      amenities: [
        { optionId: "parking", x: 9, y: 5, width: 2, height: 2 },
        { optionId: "parking", x: 12, y: 5, width: 2, height: 2 },
      ],
    });
    expect(
      reason(() => {
        validateLayout(twice, grounds, amenities);
      }),
    ).toBeNull();
  });

  it("keeps entrances on their side, one per spot", () => {
    const past = layout({ entrances: [{ side: "LEFT", offset: 19 }] });
    expect(
      reason(() => {
        validateLayout(past, grounds, amenities);
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
        validateLayout(same, grounds, amenities);
      }),
    ).toBe("DUPLICATE_ENTRANCE");
  });
});

describe("ground size ranges", () => {
  it("include each default, and never let football sizes meet", () => {
    for (const [sport, sizes] of Object.entries(FOOTPRINT_RANGES)) {
      for (const [size, range] of Object.entries(sizes)) {
        const base = FOOTPRINTS[sport as GroundSport][size as GroundSize];
        expect(base && footprintAllowed(sport as GroundSport, size as GroundSize, base)).toBe(true);
        expect(range.width[0]).toBeLessThanOrEqual(range.width[1]);
      }
    }
    const area = (size: GroundSize, end: 0 | 1) => {
      const range = FOOTPRINT_RANGES.FOOTBALL[size];
      return range ? range.width[end] * range.height[end] : 0;
    };
    expect(area("FIVE_A_SIDE", 1)).toBeLessThan(area("SEVEN_A_SIDE", 0));
    expect(area("SEVEN_A_SIDE", 1)).toBeLessThan(area("ELEVEN_A_SIDE", 0));
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
