import { describe, expect, it } from "vitest";
import { unchangedSections } from "@/modules/venues/domain/review";

// Which sections a send-back asked to change are still untouched, from the events since.

const edit = (type: string, data: unknown = {}) => ({ type, data });

describe("sections to change", () => {
  it("are all untouched with no edits since", () => {
    expect(unchangedSections(["PHOTOS", "GROUNDS"], [])).toEqual(["PHOTOS", "GROUNDS"]);
  });

  it("clear with any edit to them", () => {
    expect(
      unchangedSections(
        ["PHOTOS", "GROUNDS", "SCHEDULES", "LAYOUT"],
        [edit("VENUE_PHOTOS_REORDERED"), edit("GROUND_SCHEDULE_COPIED")],
      ),
    ).toEqual(["GROUNDS", "LAYOUT"]);
  });

  it("tell the phone (Details) from the tax number", () => {
    const phone = edit("VENUE_DETAILS_CHANGED", { changes: { phone: {} } });
    const tax = edit("VENUE_DETAILS_CHANGED", { changes: { taxNumber: {} } });
    expect(unchangedSections(["DETAILS", "TAX_NUMBER"], [phone])).toEqual(["TAX_NUMBER"]);
    expect(unchangedSections(["DETAILS", "TAX_NUMBER"], [tax])).toEqual(["DETAILS"]);
  });

  it("count a translation as a Details edit", () => {
    expect(unchangedSections(["DETAILS"], [edit("VENUE_TRANSLATION_CHANGED")])).toEqual([]);
  });

  it("don't count an edit to another section", () => {
    expect(unchangedSections(["AMENITIES"], [edit("VENUE_SETTINGS_CHANGED")])).toEqual([
      "AMENITIES",
    ]);
  });
});
