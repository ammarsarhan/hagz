import { StaffPermissions, type PermissionArea, type PermissionLevel } from "@hagz/contracts";

// Decided 2026-10-27: each area of the dashboard gets none < view < manage. Owners can do everything
// whatever is stored, so a venue can never lock its owner out.

const RANK: Record<PermissionLevel, number> = { none: 0, view: 1, manage: 2 };

export const AREAS = Object.keys(StaffPermissions.shape) as PermissionArea[];

const everywhere = (level: PermissionLevel) =>
  Object.fromEntries(AREAS.map((area) => [area, level])) as StaffPermissions;

export const NO_PERMISSIONS = everywhere("none");
export const ALL_PERMISSIONS = everywhere("manage");

// Stored permissions are plain JSON. Anything that doesn't parse grants nothing.
export const parsePermissions = (stored: unknown): StaffPermissions => {
  const parsed = StaffPermissions.safeParse(stored);
  return parsed.success ? parsed.data : NO_PERMISSIONS;
};

export const effectivePermissions = (role: "OWNER" | "MEMBER", stored: unknown) =>
  role === "OWNER" ? ALL_PERMISSIONS : parsePermissions(stored);

export const allows = (granted: PermissionLevel, needed: PermissionLevel) =>
  RANK[granted] >= RANK[needed];

// Lowers every area to at most `ceiling`. Never raises one: an area someone was kept out of stays
// closed.
export const capPermissions = (
  permissions: StaffPermissions,
  ceiling: PermissionLevel,
): StaffPermissions =>
  Object.fromEntries(
    AREAS.map((area) => [area, allows(ceiling, permissions[area]) ? permissions[area] : ceiling]),
  ) as StaffPermissions;

// Who hears about changes to a venue's staff: the owner and anyone who manages staff.
export const managesStaff = (role: "OWNER" | "MEMBER", stored: unknown) =>
  allows(effectivePermissions(role, stored).staff, "manage");

export const samePermissions = (a: StaffPermissions, b: StaffPermissions) =>
  AREAS.every((area) => a[area] === b[area]);

// The areas where `requested` goes beyond what the granting member has. Only the owner can give more
// than they have, so a staff manager can't hand a colleague (or, through them, themselves) the finance
// area they were kept out of.
export const beyondGranter = (granter: StaffPermissions, requested: StaffPermissions) =>
  AREAS.filter((area) => !allows(granter[area], requested[area]));
