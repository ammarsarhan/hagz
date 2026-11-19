import type { BanStaff, GrantPasswordReset, SuspendAccount } from "@hagz/contracts";
import { Prisma } from "@/generated/prisma/client";
import type { AccountStatus } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction, type Tx } from "@/platform/db/transaction";
import { recordStaffAccountChange, venuesOwnedBy } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import {
  CUSTOMER_REACTIVATED,
  CUSTOMER_SUSPENDED,
  STAFF_BANNED,
  STAFF_PASSWORD_RESET_GRANTED,
  STAFF_REACTIVATED,
  STAFF_SUSPENDED,
} from "../domain/events";
import { SUPPORT_RESET_TTL_SECONDS, type AccountType } from "../domain/policy";
import { customers, staff } from "./accounts";
import { redis } from "./verification-codes";

// Admin support on customer and staff accounts (the Support page and a venue's Team tab):
// suspending and reactivating either, banning staff, and letting a venue owner reset their
// password. Each is recorded as an AccountEvent with the admin and their reason; a staff account's
// changes also on each venue they're on, through venues (staff-account-changes.ts), so its admins
// see them in the venue's History.

export const accountBanned = () =>
  new AppError({
    code: "ACCOUNT_BANNED",
    status: 409,
    detail: "This account was closed for good; it can't be suspended or reactivated.",
  });

const customerNotFound = () =>
  new AppError({ code: "CUSTOMER_NOT_FOUND", status: 404, detail: "There's no such customer." });

const staffNotFound = () =>
  new AppError({ code: "STAFF_NOT_FOUND", status: 404, detail: "There's no such staff account." });

const ownsVenues = (venueIds: string[]) =>
  new AppError({
    code: "OWNS_A_VENUE",
    status: 409,
    detail: "They own a venue. Transfer it to another member before banning them.",
    extensions: { venueIds },
  });

const staffNotActive = (status: AccountStatus) =>
  new AppError({
    code: "STAFF_NOT_ACTIVE",
    status: 409,
    detail: "Their account is suspended or closed. Reactivate it first.",
    extensions: { staffStatus: status },
  });

// Locked, so two admins acting on one account run in turn. Deleted accounts don't exist here.
const lockAccount = async (tx: Tx, table: "Customer" | "Staff", id: string) => {
  const [account] = await tx.$queryRaw<{ status: AccountStatus; deletedAt: Date | null }[]>`
    SELECT status, "deletedAt" FROM ${Prisma.raw(`"${table}"`)} WHERE id = ${id}::uuid FOR UPDATE`;
  return account?.deletedAt === null ? account.status : null;
};

// Until an admin reactivates them, and signed out everywhere (push tokens too, so nothing is sent
// there). Sign-in and refreshing a session refuse an account that isn't active; an access token they
// still hold works until it expires, within 10 minutes, which is accepted for customers. Suspending
// again changes nothing.
export const suspendCustomer = async (
  adminId: string,
  customerId: string,
  { reason }: SuspendAccount,
  clock: Clock = systemClock,
) => {
  await transaction(async (tx) => {
    const status = await lockAccount(tx, "Customer", customerId);
    if (!status) throw customerNotFound();
    if (status === "BANNED") throw accountBanned();
    if (status === "SUSPENDED") return;
    await tx.customer.update({ where: { id: customerId }, data: { status: "SUSPENDED" } });
    await customers.sessions.revoke(tx, customerId, clock.now());
    await tx.accountEvent.create({
      data: { adminId, customerId, type: CUSTOMER_SUSPENDED, data: { reason } },
    });
  });
};

// Lets them sign in again. Their sessions stay revoked, so they sign in afresh. Reactivating an
// active account changes nothing.
export const reactivateCustomer = async (adminId: string, customerId: string) => {
  await transaction(async (tx) => {
    const status = await lockAccount(tx, "Customer", customerId);
    if (!status) throw customerNotFound();
    if (status === "BANNED") throw accountBanned();
    if (status === "ACTIVE") return;
    await tx.customer.update({ where: { id: customerId }, data: { status: "ACTIVE" } });
    await tx.accountEvent.create({ data: { adminId, customerId, type: CUSTOMER_REACTIVATED } });
  });
};

// Venue owners can't reset their password by themselves: whoever gets a recycled number would get
// the venue. Once support has checked who is asking, an admin lets them reset once, and they do it
// in the app like anyone else, with a code to their phone; an admin never picks or sees a password.
// The grant lasts a day and goes with the reset it allows (password-reset.ts). Granting again
// starts the day afresh.
export const supportResetKey = (type: AccountType, accountId: string) =>
  `support-reset:${type}:${accountId}`;

export const grantStaffPasswordReset = async (
  adminId: string,
  staffId: string,
  { reason }: GrantPasswordReset,
) => {
  await transaction(async (tx) => {
    const status = await lockAccount(tx, "Staff", staffId);
    if (!status) throw staffNotFound();
    if (status !== "ACTIVE") throw staffNotActive(status);
    await tx.accountEvent.create({
      data: { adminId, staffId, type: STAFF_PASSWORD_RESET_GRANTED, data: { reason } },
    });
  });
  // After the record is committed, so a reset is never allowed without one.
  const key = supportResetKey("staff", staffId);
  await redis((r) => r.set(key, "1", "EX", SUPPORT_RESET_TTL_SECONDS));
  // A suspension or ban committed between the record and the key above cancelled a key that wasn't
  // there yet. Read again now the key is set: either this sees it, or its cancelling comes after.
  const now = await prisma.staff.findUnique({ where: { id: staffId }, select: { status: true } });
  if (now?.status !== "ACTIVE") {
    await redis((r) => r.del(key));
    throw staffNotActive(now?.status ?? "BANNED");
  }
};

// --- Staff accounts ---

// A reset support allowed was for the account as it stood then; whatever got it suspended or banned
// may be why, so it goes, and isn't there to use if they're reactivated. After the change is
// committed, and done again if it was already suspended, which costs nothing.
const cancelSupportReset = (staffId: string) =>
  redis((r) => r.del(supportResetKey("staff", staffId)));

// Signs them out everywhere (push tokens too, so nothing is sent there) and keeps them out: sign-in
// and refreshing a session refuse an account that isn't active, and every venue route checks the
// account on each request, so even a token they still hold stops working there at once.
const keepStaffOut = async (
  tx: Tx,
  adminId: string,
  staffId: string,
  to: "SUSPENDED" | "BANNED",
  reason: string,
  clock: Clock,
) => {
  await tx.staff.update({ where: { id: staffId }, data: { status: to } });
  await staff.sessions.revoke(tx, staffId, clock.now());
  await tx.accountEvent.create({
    data: {
      adminId,
      staffId,
      type: to === "BANNED" ? STAFF_BANNED : STAFF_SUSPENDED,
      data: { reason },
    },
  });
  await recordStaffAccountChange(tx, { adminId, staffId, change: to, reason });
};

// Until an admin reactivates them. Suspending again changes nothing.
export const suspendStaff = async (
  adminId: string,
  staffId: string,
  { reason }: SuspendAccount,
  clock: Clock = systemClock,
) => {
  await transaction(async (tx) => {
    const status = await lockAccount(tx, "Staff", staffId);
    if (!status) throw staffNotFound();
    if (status === "BANNED") throw accountBanned();
    if (status === "SUSPENDED") return;
    await keepStaffOut(tx, adminId, staffId, "SUSPENDED", reason, clock);
  });
  await cancelSupportReset(staffId);
};

// For good: a banned account can't be reactivated (sign-in answers ACCOUNT_BANNED). Not while they
// own a venue, which would be left with an owner who can never sign in: transfer it first. A
// suspended account can be banned; banning again changes nothing.
export const banStaff = async (
  adminId: string,
  staffId: string,
  { reason }: BanStaff,
  clock: Clock = systemClock,
) => {
  await transaction(async (tx) => {
    const status = await lockAccount(tx, "Staff", staffId);
    if (!status) throw staffNotFound();
    if (status === "BANNED") return;
    const owned = await venuesOwnedBy(tx, staffId);
    if (owned.length > 0) throw ownsVenues(owned);
    await keepStaffOut(tx, adminId, staffId, "BANNED", reason, clock);
  });
  await cancelSupportReset(staffId);
};

// Lets them sign in again. Their sessions stay revoked, so they sign in afresh, and a reset support
// allowed before they were suspended stays cancelled. Reactivating an active account changes
// nothing.
export const reactivateStaff = async (adminId: string, staffId: string) => {
  await transaction(async (tx) => {
    const status = await lockAccount(tx, "Staff", staffId);
    if (!status) throw staffNotFound();
    if (status === "BANNED") throw accountBanned();
    if (status === "ACTIVE") return;
    await tx.staff.update({ where: { id: staffId }, data: { status: "ACTIVE" } });
    await tx.accountEvent.create({ data: { adminId, staffId, type: STAFF_REACTIVATED } });
    await recordStaffAccountChange(tx, { adminId, staffId, change: "REACTIVATED" });
  });
};
