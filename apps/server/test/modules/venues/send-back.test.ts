import { describe, expect, it } from "vitest";
import { unchangedSections } from "@/modules/venues/domain/review";

// Which sections a send-back asked to change still hold what they held then, by fingerprint.

describe("sections to change", () => {
  it("are unchanged while their fingerprints match", () => {
    expect(
      unchangedSections(
        ["PHOTOS", "GROUNDS"],
        { PHOTOS: "a", GROUNDS: "b" },
        { PHOTOS: "a", GROUNDS: "b" },
      ),
    ).toEqual(["PHOTOS", "GROUNDS"]);
  });

  it("are changed once their fingerprints differ", () => {
    expect(
      unchangedSections(
        ["PHOTOS", "GROUNDS"],
        { PHOTOS: "a", GROUNDS: "b" },
        { PHOTOS: "c", GROUNDS: "b" },
      ),
    ).toEqual(["GROUNDS"]);
  });

  it("don't hold anything up without a kept fingerprint", () => {
    expect(unchangedSections(["LAYOUT"], {}, { LAYOUT: "a" })).toEqual([]);
  });
});
