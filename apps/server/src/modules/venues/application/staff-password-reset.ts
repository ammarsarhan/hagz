import type { Prisma } from "@/generated/prisma/client";
import { notifyStaff } from "@/modules/notifications";
import type { Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/transaction";
import { capPermissions, managesStaff, parsePermissions } from "../domain/permissions";

// Phone numbers get recycled: whoever holds a member's old number can pass a password reset. So a reset
// makes the member read-only at every venue until someone who manages staff restores them (decided
// 2026-10-26). Owners can't reset by themselves at all; they go through support.

export const RESTRICTED_AFTER_PASSWORD_RESET = "STAFF_RESTRICTED_AFTER_PASSWORD_RESET";

export const ownsAVenue = async (staffId: string) =>
  (await prisma.venueMembership.count({ where: { staffId, role: "OWNER" } })) > 0;

interface LockedMembership {
  venueId: string;
  role: "OWNER" | "MEMBER";
  permissions: Prisma.JsonValue;
}

// Runs in the reset's transaction. The previous permissions go into a VenueEvent so they can be
// restored in one step, and the venue's staff managers are notified.
export const restrictAfterPasswordReset = async (tx: Tx, staffId: string, clock: Clock) => {
  // Locked in a fixed order, so a concurrent permission change can't be lost or deadlock with this.
  const memberships = await tx.$queryRaw<LockedMembership[]>`
    SELECT "venueId", role, permissions FROM "VenueMembership"
    WHERE "staffId" = ${staffId}::uuid
    ORDER BY "venueId"
    FOR UPDATE`;

  for (const { venueId, role, permissions } of memberships) {
    // Callers never reach here for an owner; this keeps an owner unrestricted even if one does.
    if (role === "OWNER") continue;
    const restricted = capPermissions(parsePermissions(permissions), "view");
    await tx.venueMembership.update({
      where: { venueId_staffId: { venueId, staffId } },
      data: { permissions: restricted },
    });
    const event = await tx.venueEvent.create({
      data: {
        venueId,
        type: RESTRICTED_AFTER_PASSWORD_RESET,
        staffId,
        data: { previousPermissions: permissions, permissions: restricted },
      },
    });

    const colleagues = await tx.venueMembership.findMany({
      where: { venueId, staffId: { not: staffId } },
      select: { staffId: true, role: true, permissions: true },
    });
    await notifyStaff(
      tx,
      colleagues
        .filter((member) => managesStaff(member.role, member.permissions))
        .map((member) => ({
          staffId: member.staffId,
          venueId,
          type: "STAFF_PASSWORD_RESET" as const,
          data: { staffId, eventId: event.id },
        })),
      clock,
    );
  }
};
