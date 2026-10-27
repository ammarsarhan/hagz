import type { StaffPermissions } from "@hagz/contracts";
import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  capPermissions,
  effectivePermissions,
  managesStaff,
  NO_PERMISSIONS,
  parsePermissions,
} from "@/modules/venues/domain/permissions";

const mixed: StaffPermissions = {
  bookings: "manage",
  customers: "view",
  schedule: "none",
  payments: "manage",
  finance: "none",
  staff: "view",
  venue: "manage",
};

describe("permissions", () => {
  it("caps each area without raising any", () => {
    expect(capPermissions(mixed, "view")).toEqual({
      ...mixed,
      bookings: "view",
      payments: "view",
      venue: "view",
    });
    expect(capPermissions(mixed, "none")).toEqual(NO_PERMISSIONS);
    expect(capPermissions(mixed, "manage")).toEqual(mixed);
  });

  it("gives owners everything, whatever is stored", () => {
    expect(effectivePermissions("OWNER", NO_PERMISSIONS)).toEqual(ALL_PERMISSIONS);
    expect(effectivePermissions("OWNER", "garbage")).toEqual(ALL_PERMISSIONS);
    expect(effectivePermissions("MEMBER", mixed)).toEqual(mixed);
  });

  it("grants nothing for stored JSON it can't read", () => {
    expect(parsePermissions(null)).toEqual(NO_PERMISSIONS);
    expect(parsePermissions({ ...mixed, finance: "admin" })).toEqual(NO_PERMISSIONS);
    // A missing area is unreadable too, not "the rest still count".
    expect(parsePermissions({ ...mixed, venue: undefined })).toEqual(NO_PERMISSIONS);
  });

  it("knows who manages staff", () => {
    expect(managesStaff("OWNER", NO_PERMISSIONS)).toBe(true);
    expect(managesStaff("MEMBER", { ...NO_PERMISSIONS, staff: "manage" })).toBe(true);
    expect(managesStaff("MEMBER", mixed)).toBe(false);
  });
});
