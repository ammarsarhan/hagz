import { describe, expect, it } from "vitest";
import { editable } from "@/modules/venues/domain/edit-rules";

describe("what can be edited in each status", () => {
  it.each([
    ["DRAFT", true, true],
    ["SUBMITTED", false, false],
    ["PROVISIONING", false, true],
    ["LIVE", true, true],
    ["MAINTENANCE", true, true],
  ] as const)("%s: listing %s, operations %s", (status, listing, operations) => {
    expect(editable(status, "listing")).toBe(listing);
    expect(editable(status, "operations")).toBe(operations);
  });
});
