import type { RemoveMember, TransferOwnership } from "@hagz/contracts";
import { notifyStaff } from "@/modules/notifications";
import type { VenueStatus } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { OWNERSHIP_TRANSFERRED, STAFF_REMOVED } from "../domain/events";
import { ALL_PERMISSIONS } from "../domain/permissions";
import { venueNotFound } from "./access";
import { revokeInvitation } from "./invitations";
import { UNFINISHED, unfinishedVenueExists } from "./venue-setup";

// Admin support on a venue's team (the Team tab): removing a member, revoking an invitation and
// handing the venue to another member. The venue's own staff run their team in the dashboard app;
// these are for when they can't (an owner who left, a lost phone, abuse). Each is recorded as a
// VenueEvent with the admin as the actor and their reason. Suspending, reactivating and banning a
// staff account are identity's (account-support.ts), which records them here through
// staff-account-changes.ts.

const memberNotFound = () =>
  new AppError({
    code: "MEMBER_NOT_FOUND",
    status: 404,
    detail: "This person isn't a member of the venue.",
  });

const ownerCantBeRemoved = () =>
  new AppError({
    code: "OWNER_CANT_BE_REMOVED",
    status: 409,
    detail: "The owner can't be removed. Transfer the venue to another member first.",
  });

const alreadyOwner = () =>
  new AppError({ code: "ALREADY_OWNER", status: 409, detail: "They already own this venue." });

const staffNotActive = (status: string) =>
  new AppError({
    code: "STAFF_NOT_ACTIVE",
    status: 409,
    detail: "Their account is suspended or closed, so they can't be made the owner.",
    extensions: { staffStatus: status },
  });

// The venue, locked so team changes can't race each other or a submission. Its status, for the
// one-unfinished-venue rule on transfers.
const lockVenue = async (tx: Tx, venueId: string) => {
  const [venue] = await tx.$queryRaw<{ status: VenueStatus }[]>`
    SELECT status FROM "Venue" WHERE id = ${venueId}::uuid FOR UPDATE`;
  if (!venue) throw venueNotFound();
  return venue.status;
};

const membership = (tx: Tx, venueId: string, staffId: string) =>
  tx.venueMembership.findUnique({
    where: { venueId_staffId: { venueId, staffId } },
    select: {
      role: true,
      permissions: true,
      staff: { select: { name: true, status: true, deletedAt: true } },
    },
  });

// Off the staff. Never the owner: the venue would have nobody who can run it. Their membership goes;
// their account, and their name on what they did here, stay.
export const removeMember = async (
  adminId: string,
  venueId: string,
  staffId: string,
  { reason }: RemoveMember,
  clock: Clock = systemClock,
) => {
  await transaction(async (tx) => {
    await lockVenue(tx, venueId);
    const member = await membership(tx, venueId, staffId);
    if (!member) throw memberNotFound();
    if (member.role === "OWNER") throw ownerCantBeRemoved();
    await tx.venueMembership.delete({ where: { venueId_staffId: { venueId, staffId } } });
    await tx.venueEvent.create({
      data: {
        venueId,
        adminId,
        type: STAFF_REMOVED,
        data: {
          staffId,
          name: member.staff.name,
          permissions: member.permissions ?? {},
          reason,
        },
      },
    });
    await notifyStaff(tx, [{ staffId, venueId, type: "STAFF_REMOVED", data: {} }], clock);
  });
};

export const revokeInvitationAsAdmin = (adminId: string, venueId: string, invitationId: string) =>
  revokeInvitation({ venueId, adminId }, invitationId);

// To an existing member (docs/onboarding.md, "Transfer ownership"), after support has checked who
// they are: ownership controls payouts. The old owner stays on as a member who can manage
// everything; both are told. A venue that isn't live yet counts as the new owner's one unfinished
// venue, so it's refused when they already own another (their staff row is locked for that check,
// as when creating a venue).
export const transferOwnership = async (
  adminId: string,
  venueId: string,
  { staffId, reason }: TransferOwnership,
  clock: Clock = systemClock,
) => {
  await transaction(async (tx) => {
    const status = await lockVenue(tx, venueId);
    const member = await membership(tx, venueId, staffId);
    if (!member) throw memberNotFound();
    if (member.role === "OWNER") throw alreadyOwner();
    if (member.staff.status !== "ACTIVE" || member.staff.deletedAt !== null) {
      throw staffNotActive(member.staff.status);
    }
    if (UNFINISHED.includes(status)) {
      await tx.$queryRaw`SELECT id FROM "Staff" WHERE id = ${staffId}::uuid FOR UPDATE`;
      const other = await tx.venue.findFirst({
        where: {
          id: { not: venueId },
          status: { in: UNFINISHED },
          memberships: { some: { staffId, role: "OWNER" } },
        },
        select: { id: true, status: true },
      });
      if (other) throw unfinishedVenueExists(other);
    }

    const owner = await tx.venueMembership.findFirst({
      where: { venueId, role: "OWNER" },
      select: { staffId: true },
    });
    // One owner per venue (a partial unique index): the old one steps down before the new one
    // steps up.
    if (owner) {
      await tx.venueMembership.update({
        where: { venueId_staffId: { venueId, staffId: owner.staffId } },
        data: { role: "MEMBER", permissions: ALL_PERMISSIONS },
      });
    }
    await tx.venueMembership.update({
      where: { venueId_staffId: { venueId, staffId } },
      data: { role: "OWNER" },
    });
    await tx.venueEvent.create({
      data: {
        venueId,
        adminId,
        type: OWNERSHIP_TRANSFERRED,
        data: { fromStaffId: owner?.staffId ?? null, toStaffId: staffId, reason },
      },
    });
    const data = { fromStaffId: owner?.staffId ?? "", toStaffId: staffId };
    await notifyStaff(
      tx,
      [staffId, ...(owner ? [owner.staffId] : [])].map((to) => ({
        staffId: to,
        venueId,
        type: "OWNERSHIP_TRANSFERRED" as const,
        data,
      })),
      clock,
    );
  });
};
