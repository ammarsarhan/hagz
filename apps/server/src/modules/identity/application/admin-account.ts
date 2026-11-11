import type { Admin, ChangeAdminPassword, UpdateAdminProfile } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword, verifyPassword } from "@/platform/crypto/passwords";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { consume } from "@/platform/rate-limit/rate-limit";
import { limits } from "../domain/policy";
import { cancelAdminPasswordReset } from "./admin-resets";
import { accountSuspended } from "./sessions";

// The signed-in admin changing their own account, from the Account page: their name, and their
// password after confirming the current one. The email is their sign-in and stays as invited.

const activeAdmin = async (adminId: string) => {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (admin?.status !== "ACTIVE") throw accountSuspended();
  return admin;
};

export const updateAdminProfile = async (
  adminId: string,
  { name }: UpdateAdminProfile,
): Promise<Admin> => {
  await activeAdmin(adminId);
  const admin = await prisma.admin.update({ where: { id: adminId }, data: { name } });
  logger.info({ adminId }, "admin renamed themselves");
  return { id: admin.id, name: admin.name, email: admin.email };
};

// 400, not 401: the session is fine, and a 401 would send the app to sign in again.
const wrongPassword = () =>
  new AppError({
    code: "WRONG_PASSWORD",
    status: 400,
    detail: "That isn't your current password.",
  });

// Sets the new password and signs every other browser out; this one stays signed in. A reset link
// another admin sent stops working.
export const changeAdminPassword = async (
  { adminId, sessionId }: { adminId: string; sessionId: string },
  { currentPassword, newPassword }: ChangeAdminPassword,
  clock: Clock = systemClock,
) => {
  await consume(limits.adminPasswordChangePerAdmin, adminId);
  const admin = await activeAdmin(adminId);
  if (!(await verifyPassword(admin.passwordHash, currentPassword))) throw wrongPassword();

  // Slow on purpose (argon2), so it happens before the transaction holds a connection.
  const passwordHash = await hashPassword(newPassword);
  await transaction(async (tx) => {
    await tx.admin.update({ where: { id: adminId }, data: { passwordHash } });
    await tx.adminSession.updateMany({
      where: { adminId, revokedAt: null, id: { not: sessionId } },
      data: { revokedAt: clock.now() },
    });
  });
  await cancelAdminPasswordReset(adminId);
  logger.info({ adminId }, "admin changed their password");
};

const browserNotFound = () =>
  new AppError({
    code: "SESSION_NOT_FOUND",
    status: 404,
    detail: "You aren't signed in on that browser.",
  });

// Signs one of the admin's other browsers out. Only their own, and not the one asking: that's
// signing out, which also clears the cookies.
export const signOutAdminBrowser = async (
  { adminId, sessionId }: { adminId: string; sessionId: string },
  id: string,
  clock: Clock = systemClock,
) => {
  if (id === sessionId) {
    throw new AppError({
      code: "CURRENT_SESSION",
      status: 409,
      detail: "That's this browser. Sign out instead.",
    });
  }
  const { count } = await prisma.adminSession.updateMany({
    where: { id, adminId, revokedAt: null, expiresAt: { gt: clock.now() } },
    data: { revokedAt: clock.now() },
  });
  if (count === 0) throw browserNotFound();
  logger.info({ adminId, sessionId: id }, "admin signed out one of their browsers");
};

// Signs every browser but this one out.
export const signOutOtherAdminBrowsers = async (
  { adminId, sessionId }: { adminId: string; sessionId: string },
  clock: Clock = systemClock,
) => {
  const { count } = await prisma.adminSession.updateMany({
    where: { adminId, revokedAt: null, id: { not: sessionId } },
    data: { revokedAt: clock.now() },
  });
  logger.info({ adminId, count }, "admin signed out their other browsers");
};
