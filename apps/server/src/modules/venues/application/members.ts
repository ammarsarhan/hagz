import type { StaffPermissions, StaffVenue, VenueMember } from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import {
  PERMISSION_EVENTS,
  PERMISSIONS_CHANGED,
  RESTRICTED_AFTER_PASSWORD_RESET,
  type PermissionEventData,
} from "../domain/events";
import {
  allows,
  beyondGranter,
  effectivePermissions,
  parsePermissions,
  samePermissions,
} from "../domain/permissions";
import { accountSuspended, missingPermission, venueNotFound, type VenueAccess } from "./access";

// The venues a member belongs to, for the dashboard's venue switcher.
export const listMyVenues = async (staffId: string, language: Language): Promise<StaffVenue[]> => {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      status: true,
      deletedAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          permissions: true,
          venue: {
            select: {
              id: true,
              slug: true,
              status: true,
              translations: { select: { language: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (staff?.status !== "ACTIVE" || staff.deletedAt !== null) throw accountSuspended();
  return staff.memberships.map(({ role, permissions, venue }) => ({
    id: venue.id,
    slug: venue.slug,
    name:
      (venue.translations.find((t) => t.language === language) ?? venue.translations[0])?.name ??
      null,
    status: venue.status,
    role,
    permissions: effectivePermissions(role, permissions),
  }));
};

// The newest permission event of each member: when it's a password-reset restriction, it's what
// restore brings back. Ties within one transaction are broken by id (uuid v7, time-ordered).
const latestPermissionEvents = async (
  db: Tx | typeof prisma,
  venueId: string,
  memberIds: string[],
) => {
  if (memberIds.length === 0) return new Map<string, LatestEvent>();
  const rows = await db.$queryRaw<{ type: string; data: PermissionEventData }[]>`
    SELECT DISTINCT ON (data->>'memberId') type, data FROM "VenueEvent"
    WHERE "venueId" = ${venueId}::uuid AND type = ANY(${PERMISSION_EVENTS})
      AND data->>'memberId' = ANY(${memberIds})
    ORDER BY data->>'memberId', "createdAt" DESC, id DESC`;
  return new Map(rows.map((row) => [row.data.memberId, row]));
};

interface LatestEvent {
  type: string;
  data: PermissionEventData;
}

const restorableFrom = (latest: LatestEvent | undefined, current: StaffPermissions) =>
  latest?.type === RESTRICTED_AFTER_PASSWORD_RESET &&
  // Nothing changed since: a manager who already set new permissions isn't overridden.
  samePermissions(parsePermissions(latest.data.permissions), current)
    ? parsePermissions(latest.data.previousPermissions)
    : undefined;

export const listMembers = async (venueId: string): Promise<VenueMember[]> => {
  const memberships = await prisma.venueMembership.findMany({
    where: { venueId },
    orderBy: { createdAt: "asc" },
    select: {
      staffId: true,
      role: true,
      permissions: true,
      staff: { select: { name: true, phone: true } },
    },
  });
  const latest = await latestPermissionEvents(
    prisma,
    venueId,
    memberships.map((m) => m.staffId),
  );
  return memberships.map(({ staffId, role, permissions, staff }) => {
    const current = effectivePermissions(role, permissions);
    return {
      staffId,
      name: staff.name,
      phone: staff.phone,
      role,
      permissions: current,
      restorable: role === "MEMBER" && restorableFrom(latest.get(staffId), current) !== undefined,
    };
  });
};

const forbidden = (code: string, detail: string, extensions?: Record<string, unknown>) =>
  new AppError({ code, status: 403, detail, extensions });

interface LockedMembership {
  staffId: string;
  role: "OWNER" | "MEMBER";
  permissions: Prisma.JsonValue;
}

// Sets a member's permissions, within the granter's own, and records the change. Both memberships
// are locked (in a fixed order) before anything is decided, so neither can change under the check.
const setPermissions = (
  actor: VenueAccess,
  memberId: string,
  decide: (tx: Tx, member: LockedMembership) => Promise<StaffPermissions>,
) =>
  transaction(async (tx) => {
    const { venueId, staffId: actorId } = actor;
    if (memberId === actorId) {
      throw forbidden("CANNOT_CHANGE_OWN_PERMISSIONS", "Ask someone else who manages staff.");
    }
    const locked = await tx.$queryRaw<LockedMembership[]>`
    SELECT "staffId", role, permissions FROM "VenueMembership"
    WHERE "venueId" = ${venueId}::uuid AND "staffId" IN (${actorId}::uuid, ${memberId}::uuid)
    ORDER BY "staffId"
    FOR UPDATE`;
    const granter = locked.find((m) => m.staffId === actorId);
    const member = locked.find((m) => m.staffId === memberId);
    // The granter was removed, or lost the right, since the request's access check.
    if (!granter) throw venueNotFound();
    const granted = effectivePermissions(granter.role, granter.permissions);
    if (!allows(granted.staff, "manage")) throw missingPermission("staff", "manage");
    if (!member) {
      throw new AppError({ code: "MEMBER_NOT_FOUND", status: 404, detail: "No such member here." });
    }
    if (member.role === "OWNER") {
      throw forbidden("CANNOT_CHANGE_OWNER", "The owner can always do everything.");
    }
    const next = await decide(tx, member);
    const beyond = beyondGranter(granted, next);
    if (beyond.length > 0) {
      throw forbidden("PERMISSION_ABOVE_YOUR_OWN", "You can't give more than you have yourself.", {
        areas: beyond,
      });
    }

    await tx.venueMembership.update({
      where: { venueId_staffId: { venueId, staffId: memberId } },
      data: { permissions: next },
    });
    await tx.venueEvent.create({
      data: {
        venueId,
        type: PERMISSIONS_CHANGED,
        staffId: actorId,
        data: { memberId, previousPermissions: member.permissions, permissions: next },
      },
    });
    return next;
  });

export const changePermissions = (actor: VenueAccess, memberId: string, next: StaffPermissions) =>
  setPermissions(actor, memberId, () => Promise.resolve(next));

// Undoes a password reset's restriction in one step, if nothing changed since.
export const restorePermissions = (actor: VenueAccess, memberId: string) =>
  setPermissions(actor, memberId, async (tx, member) => {
    const latest = await latestPermissionEvents(tx, actor.venueId, [memberId]);
    const previous = restorableFrom(latest.get(memberId), parsePermissions(member.permissions));
    if (!previous) {
      throw new AppError({
        code: "NOTHING_TO_RESTORE",
        status: 409,
        detail: "Their permissions have changed since the reset; set them directly.",
      });
    }
    return previous;
  });
