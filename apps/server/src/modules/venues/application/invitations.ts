import type {
  ReceivedStaffInvitation,
  StaffInvitation,
  StaffPermissions,
  StaffVenue,
} from "@hagz/contracts";
import { Prisma } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { notifyStaff } from "@/modules/notifications";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { generateJoinCode, hashCode, normalizeJoinCode } from "@/platform/crypto/codes";
import { violatedUniqueIndex } from "@/platform/db/errors";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { webLinks } from "@/platform/http/links";
import { messaging } from "@/platform/messaging/messaging";
import { requireMobileNumber } from "@/platform/phone/phone";
import { consume } from "@/platform/rate-limit/rate-limit";
import {
  STAFF_INVITATION_DECLINED,
  STAFF_INVITATION_REVOKED,
  STAFF_INVITED,
  STAFF_JOINED,
} from "../domain/events";
import { nameIn } from "../domain/names";
import {
  allows,
  beyondGranter,
  effectivePermissions,
  NO_PERMISSIONS,
  parsePermissions,
} from "../domain/permissions";
import {
  accountSuspended,
  missingPermission,
  permissionAboveYourOwn,
  venueNotFound,
  type VenueAccess,
} from "./access";
import { staffManagersOf } from "./staff-managers";

// Staff join a venue only by invitation (decided 2026-10-24). A member who manages staff enters a phone
// number and the permissions to give; the invitee gets a WhatsApp message with a link that opens the
// dashboard app, or finds it under their invitations if they already have an account. Accepting needs
// a signed-in staff account whose verified phone is the invited one. Single use, 48 hours, one open
// invitation per phone per venue: a new one replaces the old.

export const INVITATION_TTL_SECONDS = 48 * 60 * 60;
const minutes = (n: number) => n * 60_000;
const hours = (n: number) => n * 3_600_000;

const limits = {
  // WhatsApp messages cost money and a phone shouldn't be spammed by any one venue.
  invitesPerVenue: { name: "staff-invite:venue", limit: 50, windowMs: hours(24) },
  invitesPerPhone: { name: "staff-invite:phone", limit: 5, windowMs: hours(24) },
  // Typed or guessed codes.
  acceptPerStaff: { name: "staff-invite:accept:staff", limit: 10, windowMs: minutes(15) },
  acceptPerIp: { name: "staff-invite:accept:ip", limit: 30, windowMs: minutes(15) },
} as const;

const invitationNotFound = () =>
  new AppError({
    code: "INVITATION_NOT_FOUND",
    status: 404,
    detail: "There's no invitation for you with that code.",
  });

const invitationExpired = () =>
  new AppError({
    code: "INVITATION_EXPIRED",
    status: 410,
    detail: "This invitation has expired or was withdrawn. Ask for a new one.",
  });

const alreadyMember = () =>
  new AppError({
    code: "ALREADY_A_MEMBER",
    status: 409,
    detail: "That person is already on this venue's staff.",
  });

interface InvitationRow {
  id: string;
  venueId: string;
  phone: string;
  permissions: Prisma.JsonValue;
  invitorId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

const isOpen = (invitation: InvitationRow, now: Date) =>
  invitation.acceptedAt === null && invitation.revokedAt === null && invitation.expiresAt > now;

// ---- The venue's side ----

const presentSent = (
  invitation: InvitationRow & { invitor: { name: string } },
): StaffInvitation => ({
  id: invitation.id,
  phone: invitation.phone,
  permissions: parsePermissions(invitation.permissions),
  invitedBy: invitation.invitor.name,
  createdAt: invitation.createdAt.toISOString(),
  expiresAt: invitation.expiresAt.toISOString(),
});

// The granter's membership, locked, so their right to invite can't change under the check.
const lockGranter = async (tx: Tx, venueId: string, staffId: string) => {
  const [granter] = await tx.$queryRaw<
    { role: "OWNER" | "MEMBER"; permissions: Prisma.JsonValue }[]
  >`
    SELECT role, permissions FROM "VenueMembership"
    WHERE "venueId" = ${venueId}::uuid AND "staffId" = ${staffId}::uuid
    FOR SHARE`;
  return granter ? effectivePermissions(granter.role, granter.permissions) : undefined;
};

export const inviteStaff = async (
  actor: VenueAccess,
  { phone: input, permissions }: { phone: string; permissions?: StaffPermissions },
  language: Language,
  clock: Clock = systemClock,
): Promise<StaffInvitation> => {
  const phone = requireMobileNumber(input).e164;
  if (!webLinks) throw unavailableHere();
  await consume(limits.invitesPerVenue, actor.venueId);
  await consume(limits.invitesPerPhone, `${actor.venueId}:${phone}`);

  const created = await createInvitation(actor, phone, permissions, clock);

  // In the invitee's language when they already have an account, else the inviter's.
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: actor.venueId },
    select: { translations: { select: { language: true, name: true } } },
  });
  const messageLanguage = created.invitee?.language ?? language;
  try {
    await messaging.sendStaffInvitation({
      phone,
      venueName: nameIn(venue.translations, messageLanguage) ?? "Hagz",
      invitedBy: created.invitation.invitor.name,
      link: webLinks.staffInvitation(created.code),
      language: messageLanguage,
    });
  } catch (error) {
    // Nothing was sent: leave nothing behind that looks sent.
    await transaction(async (tx) => {
      await tx.notification.deleteMany({
        where: {
          type: "STAFF_INVITED",
          data: { path: ["invitationId"], equals: created.invitation.id },
        },
      });
      await tx.venueEvent.deleteMany({
        where: {
          type: STAFF_INVITED,
          data: { path: ["invitationId"], equals: created.invitation.id },
        },
      });
      await tx.venueInvitation.delete({ where: { id: created.invitation.id } });
    }).catch(() => undefined);
    throw error;
  }
  return presentSent(created.invitation);
};

const unavailableHere = () =>
  new AppError({
    code: "MESSAGING_UNAVAILABLE",
    status: 503,
    detail: "Invitations can't be sent from this environment yet.",
  });

const createInvitation = async (
  actor: VenueAccess,
  phone: string,
  requested: StaffPermissions | undefined,
  clock: Clock,
) => {
  const now = clock.now();
  // A code clash with any earlier invitation (the hash is unique) is rare; try another code.
  for (let attempt = 1; ; attempt++) {
    const code = generateJoinCode();
    try {
      return await transaction(async (tx) => {
        const granted = await lockGranter(tx, actor.venueId, actor.staffId);
        if (!granted) throw venueNotFound();
        if (!allows(granted.staff, "manage")) throw missingPermission("staff", "manage");

        const settings = await tx.venueSettings.findUnique({
          where: { venueId: actor.venueId },
          select: { defaultPermissions: true },
        });
        const permissions =
          requested ?? (settings ? parsePermissions(settings.defaultPermissions) : NO_PERMISSIONS);
        const beyond = beyondGranter(granted, permissions);
        if (beyond.length > 0) throw permissionAboveYourOwn(beyond);

        const invitee = await tx.staff.findUnique({
          where: { phone },
          select: { id: true, language: true },
        });
        if (
          invitee &&
          (await tx.venueMembership.findUnique({
            where: { venueId_staffId: { venueId: actor.venueId, staffId: invitee.id } },
            select: { staffId: true },
          }))
        ) {
          throw alreadyMember();
        }

        // A new invitation replaces an open one, so only the newest code works.
        await tx.venueInvitation.updateMany({
          where: { venueId: actor.venueId, phone, acceptedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        const invitation = await tx.venueInvitation.create({
          data: {
            venueId: actor.venueId,
            phone,
            codeHash: hashCode(code),
            permissions,
            invitorId: actor.staffId,
            expiresAt: new Date(now.getTime() + INVITATION_TTL_SECONDS * 1000),
          },
          include: { invitor: { select: { name: true } } },
        });
        await tx.venueEvent.create({
          data: {
            venueId: actor.venueId,
            type: STAFF_INVITED,
            staffId: actor.staffId,
            data: { invitationId: invitation.id, phone, permissions },
          },
        });
        // Someone who already has an account also finds it in the app.
        if (invitee) {
          await notifyStaff(
            tx,
            [
              {
                staffId: invitee.id,
                venueId: actor.venueId,
                type: "STAFF_INVITED",
                data: { invitationId: invitation.id },
              },
            ],
            clock,
          );
        }
        return { invitation, code, invitee };
      });
    } catch (error) {
      // Or a concurrent invitation to the same phone took the one open slot: run again, which
      // replaces it like any older invitation.
      const index = violatedUniqueIndex(error);
      const retryable =
        index === "VenueInvitation_codeHash_key" || index === "VenueInvitation_open_key";
      if (retryable && attempt < 3) continue;
      throw error;
    }
  }
};

export const listSentInvitations = async (venueId: string, clock: Clock = systemClock) => {
  const invitations = await prisma.venueInvitation.findMany({
    where: { venueId, acceptedAt: null, revokedAt: null, expiresAt: { gt: clock.now() } },
    orderBy: { createdAt: "desc" },
    include: { invitor: { select: { name: true } } },
  });
  return invitations.map(presentSent);
};

// Idempotent for invitations already revoked, declined or expired.
export const revokeInvitation = async (
  actor: VenueAccess,
  invitationId: string,
  clock: Clock = systemClock,
) =>
  transaction(async (tx) => {
    const invitation = await tx.venueInvitation.findFirst({
      // Scoped to the actor's venue: another venue's invitation is "not found".
      where: { id: invitationId, venueId: actor.venueId },
    });
    if (!invitation) {
      throw new AppError({
        code: "INVITATION_NOT_FOUND",
        status: 404,
        detail: "No such invitation.",
      });
    }
    if (invitation.acceptedAt !== null) {
      throw new AppError({
        code: "INVITATION_ALREADY_ACCEPTED",
        status: 409,
        detail: "They already joined; remove them from the staff instead.",
      });
    }
    const { count } = await tx.venueInvitation.updateMany({
      where: { id: invitationId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: clock.now() },
    });
    if (count > 0) {
      await tx.venueEvent.create({
        data: {
          venueId: actor.venueId,
          type: STAFF_INVITATION_REVOKED,
          staffId: actor.staffId,
          data: { invitationId },
        },
      });
    }
  });

// ---- The invitee's side ----

// The signed-in staff member's verified phone: invitations are matched against it.
const inviteeOf = async (staffId: string) => {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { phone: true, status: true, deletedAt: true },
  });
  if (staff?.status !== "ACTIVE" || staff.deletedAt !== null || !staff.phone) {
    throw accountSuspended();
  }
  return { staffId, phone: staff.phone };
};

const presentReceived = async (
  invitations: (InvitationRow & { invitor: { name: string } })[],
  language: Language,
): Promise<ReceivedStaffInvitation[]> => {
  const venues = await prisma.venue.findMany({
    where: { id: { in: invitations.map((i) => i.venueId) } },
    select: { id: true, translations: { select: { language: true, name: true } } },
  });
  return invitations.map((invitation) => ({
    id: invitation.id,
    venue: {
      id: invitation.venueId,
      name: nameIn(venues.find((v) => v.id === invitation.venueId)?.translations ?? [], language),
    },
    invitedBy: invitation.invitor.name,
    permissions: parsePermissions(invitation.permissions),
    expiresAt: invitation.expiresAt.toISOString(),
  }));
};

// Open invitations to the signed-in member's phone, from every venue.
export const listMyInvitations = async (
  staffId: string,
  language: Language,
  clock: Clock = systemClock,
) => {
  const { phone } = await inviteeOf(staffId);
  const invitations = await prisma.venueInvitation.findMany({
    where: { phone, acceptedAt: null, revokedAt: null, expiresAt: { gt: clock.now() } },
    orderBy: { createdAt: "desc" },
    include: { invitor: { select: { name: true } } },
  });
  return presentReceived(invitations, language);
};

// By the code from the link, or by id from the list. Either way it must be addressed to this phone;
// anything else is "not found", so codes and ids can't be probed.
export type InvitationLookup = { code: string } | { id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const findFor = async (
  db: Tx | typeof prisma,
  lookup: InvitationLookup,
  phone: string,
  { lock }: { lock: boolean },
) => {
  if ("id" in lookup && !UUID.test(lookup.id)) throw invitationNotFound();
  const match =
    "code" in lookup
      ? Prisma.sql`"codeHash" = ${hashCode(normalizeJoinCode(lookup.code))}`
      : Prisma.sql`id = ${lookup.id}::uuid`;
  const [invitation] = await db.$queryRaw<InvitationRow[]>`
    SELECT id, "venueId", phone, permissions, "invitorId", "expiresAt", "acceptedAt", "revokedAt",
      "createdAt"
    FROM "VenueInvitation" WHERE ${match}
    ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`;
  if (invitation?.phone !== phone) throw invitationNotFound();
  return invitation;
};

// What the link opens: which venue, who invited them and what they'd be able to do.
export const previewInvitation = async (
  staffId: string,
  lookup: InvitationLookup,
  { ip, language }: { ip: string; language: Language },
  clock: Clock = systemClock,
) => {
  await consume(limits.acceptPerIp, ip);
  await consume(limits.acceptPerStaff, staffId);
  const { phone } = await inviteeOf(staffId);
  const invitation = await findFor(prisma, lookup, phone, { lock: false });
  if (!isOpen(invitation, clock.now())) throw invitationExpired();
  const invitor = await prisma.staff.findUniqueOrThrow({
    where: { id: invitation.invitorId },
    select: { name: true },
  });
  const [received] = await presentReceived([{ ...invitation, invitor }], language);
  return received;
};

export const acceptInvitation = async (
  staffId: string,
  lookup: InvitationLookup,
  { ip, language }: { ip: string; language: Language },
  clock: Clock = systemClock,
): Promise<StaffVenue> => {
  await consume(limits.acceptPerIp, ip);
  await consume(limits.acceptPerStaff, staffId);
  const { phone } = await inviteeOf(staffId);
  const now = clock.now();

  const venueId = await transaction(async (tx) => {
    const invitation = await findFor(tx, lookup, phone, { lock: true });
    if (!isOpen(invitation, now)) throw invitationExpired();
    // An invitation is only as good as its inviter is now: one who was removed or lost the right to
    // manage staff (or the areas it grants) since can't still bring people in.
    const granted = await lockGranter(tx, invitation.venueId, invitation.invitorId);
    const permissions = parsePermissions(invitation.permissions);
    if (
      !granted ||
      !allows(granted.staff, "manage") ||
      beyondGranter(granted, permissions).length > 0
    ) {
      throw invitationExpired();
    }

    try {
      await tx.venueMembership.create({
        data: { venueId: invitation.venueId, staffId, role: "MEMBER", permissions },
      });
    } catch (error) {
      if (violatedUniqueIndex(error) === "VenueMembership_pkey") throw alreadyMember();
      throw error;
    }
    await tx.venueInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: now },
    });
    await tx.venueEvent.create({
      data: {
        venueId: invitation.venueId,
        type: STAFF_JOINED,
        staffId,
        data: { memberId: staffId, invitationId: invitation.id, permissions },
      },
    });
    const managers = await staffManagersOf(tx, invitation.venueId, staffId);
    await notifyStaff(
      tx,
      managers.map((managerId) => ({
        staffId: managerId,
        venueId: invitation.venueId,
        type: "STAFF_JOINED" as const,
        data: { staffId },
      })),
      clock,
    );
    return invitation.venueId;
  });

  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: {
      id: true,
      slug: true,
      status: true,
      translations: { select: { language: true, name: true } },
      memberships: { where: { staffId }, select: { role: true, permissions: true } },
    },
  });
  const [membership] = venue.memberships;
  return {
    id: venue.id,
    slug: venue.slug,
    name: nameIn(venue.translations, language),
    status: venue.status,
    role: membership?.role ?? "MEMBER",
    permissions: effectivePermissions(membership?.role ?? "MEMBER", membership?.permissions),
  };
};

// Turning an invitation down withdraws it; the venue can send a new one.
export const declineInvitation = async (
  staffId: string,
  invitationId: string,
  clock: Clock = systemClock,
) => {
  const { phone } = await inviteeOf(staffId);
  await transaction(async (tx) => {
    const invitation = await findFor(tx, { id: invitationId }, phone, { lock: true });
    if (!isOpen(invitation, clock.now())) return;
    await tx.venueInvitation.update({
      where: { id: invitation.id },
      data: { revokedAt: clock.now() },
    });
    await tx.venueEvent.create({
      data: {
        venueId: invitation.venueId,
        type: STAFF_INVITATION_DECLINED,
        staffId,
        data: { invitationId: invitation.id },
      },
    });
  });
};
