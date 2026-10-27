import type { PermissionArea, PermissionLevel, StaffPermissions } from "@hagz/contracts";
import { z } from "zod";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { effectivePermissions } from "../domain/permissions";

export interface VenueAccess {
  venueId: string;
  staffId: string;
  role: "OWNER" | "MEMBER";
  permissions: StaffPermissions;
}

export const accountSuspended = () =>
  new AppError({
    code: "ACCOUNT_SUSPENDED",
    status: 403,
    detail: "This account can't sign in. Please contact support.",
  });

// Venues someone isn't a member of don't exist as far as they can tell, so ids can't be probed.
export const venueNotFound = () =>
  new AppError({ code: "VENUE_NOT_FOUND", status: 404, detail: "There's no such venue." });

export const missingPermission = (area: PermissionArea, level: PermissionLevel) =>
  new AppError({
    code: "PERMISSION_DENIED",
    status: 403,
    detail: "You don't have permission to do this here.",
    extensions: { area, needed: level },
  });

const Id = z.uuid();

// Read on every request rather than carried in the access token, so a change of permissions, a
// removal or a suspension applies at once instead of when the token expires.
export const venueAccess = async (staffId: string, venueId: string): Promise<VenueAccess> => {
  if (!Id.safeParse(venueId).success) throw venueNotFound();
  const membership = await prisma.venueMembership.findUnique({
    where: { venueId_staffId: { venueId, staffId } },
    select: { role: true, permissions: true, staff: { select: { status: true, deletedAt: true } } },
  });
  if (!membership) throw venueNotFound();
  const { status, deletedAt } = membership.staff;
  if (status !== "ACTIVE" || deletedAt !== null) throw accountSuspended();
  return {
    venueId,
    staffId,
    role: membership.role,
    permissions: effectivePermissions(membership.role, membership.permissions),
  };
};
