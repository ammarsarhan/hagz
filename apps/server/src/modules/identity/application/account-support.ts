import type { GrantPasswordReset, SuspendAccount } from "@hagz/contracts";
import { Prisma } from "@/generated/prisma/client";
import type { AccountStatus } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import {
  CUSTOMER_REACTIVATED,
  CUSTOMER_SUSPENDED,
  STAFF_PASSWORD_RESET_GRANTED,
} from "../domain/events";
import { SUPPORT_RESET_TTL_SECONDS, type AccountType } from "../domain/policy";
import { customers } from "./accounts";
import { redis } from "./verification-codes";

// Admin support on customer and staff accounts (the Support page): suspending and reactivating a
// customer, and letting a venue owner reset their password. Staff suspensions and bans live with
// venues (admin-team.ts), which records them on each venue too. Each is recorded as an AccountEvent
// with the admin and their reason.

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
  await redis((r) =>
    r.set(supportResetKey("staff", staffId), "1", "EX", SUPPORT_RESET_TTL_SECONDS),
  );
};
