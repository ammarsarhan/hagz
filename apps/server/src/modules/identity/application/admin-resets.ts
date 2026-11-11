import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword } from "@/platform/crypto/passwords";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { email as mail } from "@/platform/email/email";
import { AppError } from "@/platform/errors/app-error";
import { webLinks } from "@/platform/http/links";
import { consume } from "@/platform/rate-limit/rate-limit";
import { ADMIN_PASSWORD_RESET_TTL_SECONDS, limits } from "../domain/policy";
import { adminSessions } from "./accounts";
import { adminNotFound } from "./admins";
import { redis } from "./verification-codes";

// One admin getting another back into their account. Never on your own: you're signed in, so you
// don't need it, and a slip would sign you out of the page you're using.

const ownAccount = () =>
  new AppError({
    code: "OWN_ADMIN_ACCOUNT",
    status: 409,
    detail: "Ask another admin to do this for your account.",
  });

// Forgets their authenticator and signs them out everywhere: their next sign-in, after the
// password, sets up a new one, as on their first.
export const resetAdminAuthenticator = async (
  { adminId, by }: { adminId: string; by: string },
  clock: Clock = systemClock,
) => {
  if (adminId === by) throw ownAccount();
  await transaction(async (tx) => {
    const { count } = await tx.admin.updateMany({
      where: { id: adminId },
      data: { totpSecret: null, totpConfirmedAt: null, totpLastStep: null },
    });
    if (count === 0) throw adminNotFound();
    await adminSessions.sessions.revoke(tx, adminId, clock.now());
  });
};

// Password resets are links, like invitations: one admin never picks another's password. The token
// lives in Redis for a day, by its hash; a second key per admin finds the open one, so a new link
// replaces it and only the newest works.
const resetKey = (tokenHash: string) => `admin-reset:${tokenHash}`;
const openKey = (adminId: string) => `admin-reset:open:${adminId}`;

const resetInvalid = () =>
  new AppError({
    code: "PASSWORD_RESET_INVALID",
    status: 400,
    detail: "This link has expired or was already used. Ask another admin for a new one.",
  });

const resetUrl = (token: string) => {
  if (!webLinks) {
    throw new AppError({
      code: "EMAIL_UNAVAILABLE",
      status: 503,
      detail: "Password resets can't be sent from this environment yet.",
    });
  }
  return webLinks.adminPasswordReset(token);
};

// Emails them a link to choose a new password. Nothing changes until they use it, so asking can't
// lock anyone out; their sessions end when the new password is set.
export const requestAdminPasswordReset = async (
  { adminId, by }: { adminId: string; by: string },
  clock: Clock = systemClock,
) => {
  if (adminId === by) throw ownAccount();
  await consume(limits.adminPasswordResetsPerAdmin, by);
  const [admin, requester] = await Promise.all([
    prisma.admin.findUnique({ where: { id: adminId }, select: { name: true, email: true } }),
    prisma.admin.findUniqueOrThrow({ where: { id: by }, select: { name: true } }),
  ]);
  if (!admin) throw adminNotFound();

  const token = randomToken();
  const link = resetUrl(token);
  const hash = hashToken(token);
  const ttl = ADMIN_PASSWORD_RESET_TTL_SECONDS;
  await redis(async (r) => {
    const previous = await r.get(openKey(adminId));
    const multi = r.multi();
    if (previous) multi.del(resetKey(previous));
    multi.set(resetKey(hash), adminId, "EX", ttl);
    multi.set(openKey(adminId), hash, "EX", ttl);
    await multi.exec();
  });

  try {
    await mail.sendAdminPasswordReset({
      to: admin.email,
      name: admin.name,
      requestedBy: requester.name,
      resetUrl: link,
      expiresAt: new Date(clock.now().getTime() + ttl * 1000),
    });
  } catch (error) {
    // Nothing was sent, so no link should work.
    await redis((r) => r.del(resetKey(hash), openKey(adminId))).catch(() => undefined);
    throw error;
  }
};

// An admin who changed their password themselves no longer needs a link another admin sent: it stops
// working.
export const cancelAdminPasswordReset = async (adminId: string) => {
  await redis(async (r) => {
    const open = await r.get(openKey(adminId));
    if (open) await r.del(resetKey(open), openKey(adminId));
  });
};

// Sets the new password and signs them out everywhere. The link works once, and not for an admin
// who has been suspended or banned since it was sent.
export const confirmAdminPasswordReset = async (
  { token, password, ip }: { token: string; password: string; ip: string },
  clock: Clock = systemClock,
) => {
  await consume(limits.adminPasswordResetPerIp, ip);
  const adminId = await redis((r) => r.get(resetKey(hashToken(token))));
  const admin = adminId
    ? await prisma.admin.findUnique({ where: { id: adminId }, select: { status: true } })
    : null;
  if (!adminId || admin?.status !== "ACTIVE") throw resetInvalid();

  // Slow on purpose (argon2), so it happens before the transaction holds a connection.
  const passwordHash = await hashPassword(password);
  // Taken before the change, so two tabs sending the same link can't both set a password.
  const claimed = await redis((r) => r.del(resetKey(hashToken(token))));
  if (claimed === 0) throw resetInvalid();
  await transaction(async (tx) => {
    await tx.admin.update({ where: { id: adminId }, data: { passwordHash } });
    await adminSessions.sessions.revoke(tx, adminId, clock.now());
  });
  await redis((r) => r.del(openKey(adminId)));
};
