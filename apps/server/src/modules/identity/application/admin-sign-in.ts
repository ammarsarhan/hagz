import { randomUUID } from "node:crypto";
import type { AdminChallenge, TotpSetup } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword, needsRehash, verifyPassword } from "@/platform/crypto/passwords";
import { signJwt, verifyJwt } from "@/platform/crypto/jwt";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  matchTotp,
  otpauthUri,
} from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { consume } from "@/platform/rate-limit/rate-limit";
import { guardedRedis, RedisUnavailableError, serviceUnavailable } from "@/platform/redis/guarded";
import { limits, TWO_FACTOR_CHALLENGE_TTL_SECONDS } from "../domain/policy";
import { adminSessions } from "./accounts";
import { accountSuspended, createSession, type DeviceInfo } from "./sessions";

// Admins: email + password, then a code from an authenticator app, which they must set up before
// their first session. Invite-only (admin-invitations.ts); the first one is created from the command
// line (src/create-admin.ts).

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const adminProfile = (admin: { id: string; name: string; email: string }) => ({
  id: admin.id,
  name: admin.name,
  email: admin.email,
});

// Unknown email and wrong password look the same, and take the same time.
const invalidCredentials = () =>
  new AppError({
    code: "INVALID_CREDENTIALS",
    status: 401,
    detail: "The email or password is wrong.",
  });

const challengeExpired = () =>
  new AppError({
    code: "CHALLENGE_EXPIRED",
    status: 401,
    detail: "This sign-in took too long. Please sign in again.",
  });

// A challenge proves the password; `sid` is a nonce that makes it single use (see below).
export const challengeFor = async (
  admin: { id: string; totpConfirmedAt: Date | null },
  clock: Clock,
): Promise<AdminChallenge> => ({
  challengeToken: await signJwt(
    { sub: admin.id, sid: randomUUID() },
    { audience: "admin-challenge", ttlSeconds: TWO_FACTOR_CHALLENGE_TTL_SECONDS },
    clock,
  ),
  next: admin.totpConfirmedAt ? "TOTP" : "TOTP_SETUP",
  expiresIn: TWO_FACTOR_CHALLENGE_TTL_SECONDS,
});

const readChallenge = async (challengeToken: string, clock: Clock) => {
  try {
    return await verifyJwt(challengeToken, "admin-challenge", clock);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    throw challengeExpired();
  }
};

const activeAdmin = async (adminId: string) => {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (admin?.status !== "ACTIVE") throw accountSuspended();
  return admin;
};

export const signInAdmin = async (
  { email: input, password, ip }: { email: string; password: string; ip: string },
  clock: Clock = systemClock,
): Promise<AdminChallenge> => {
  const email = normalizeEmail(input);
  await consume(limits.adminSignInPerIp, ip);
  await consume(limits.adminSignInPerEmail, email);

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!(await verifyPassword(admin?.passwordHash, password)) || !admin) {
    throw invalidCredentials();
  }
  // Only told after the right password, so it can't be used to probe which emails exist.
  if (admin.status !== "ACTIVE") throw accountSuspended();
  if (needsRehash(admin.passwordHash)) {
    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: await hashPassword(password) },
    });
  }
  return challengeFor(admin, clock);
};

// Gives an admin without an authenticator a new secret. Asking again replaces it, until a code from
// it has been accepted; after that it can't be changed here.
export const startTotpSetup = async (
  challengeToken: string,
  clock: Clock = systemClock,
): Promise<TotpSetup> => {
  const { sub } = await readChallenge(challengeToken, clock);
  const admin = await activeAdmin(sub);
  const secret = generateTotpSecret();
  const { count } = await prisma.admin.updateMany({
    where: { id: admin.id, totpConfirmedAt: null },
    data: { totpSecret: encryptTotpSecret(secret), totpLastStep: null },
  });
  if (count === 0) {
    throw new AppError({
      code: "TOTP_ALREADY_SET_UP",
      status: 409,
      detail: "This account already has an authenticator. Ask another admin to reset it.",
    });
  }
  return { secret, otpauthUri: otpauthUri({ secret, account: admin.email }) };
};

// Marks a challenge used, in Redis for as long as it could still verify. Fails closed.
const spendChallenge = async (nonce: string) => {
  const claimed = await guardedRedis((r) =>
    r.set(`admin-challenge:${nonce}`, "1", "EX", TWO_FACTOR_CHALLENGE_TTL_SECONDS, "NX"),
  );
  if (claimed === null) throw challengeExpired();
};

// The code from the authenticator opens the session. The first accepted code also confirms the setup.
export const completeAdminSignIn = async (
  { challengeToken, code, device }: { challengeToken: string; code: string; device: DeviceInfo },
  clock: Clock = systemClock,
) => {
  const { sub: adminId, sid: nonce } = await readChallenge(challengeToken, clock);
  await consume(limits.adminTotpPerIp, device.ip);
  await consume(limits.adminTotpPerAdmin, adminId);
  const now = clock.now();

  try {
    return await transaction(async (tx) => {
      // Locked, so one code can't open two sessions, and totpLastStep only moves forward.
      const [admin] = await tx.$queryRaw<
        {
          id: string;
          name: string;
          email: string;
          status: string;
          totpSecret: string | null;
          totpConfirmedAt: Date | null;
          totpLastStep: number | null;
        }[]
      >`
        SELECT id, name, email, status, "totpSecret", "totpConfirmedAt", "totpLastStep"
        FROM "Admin" WHERE id = ${adminId}::uuid
        FOR UPDATE`;
      if (admin?.status !== "ACTIVE") throw accountSuspended();
      if (!admin.totpSecret) {
        throw new AppError({
          code: "TOTP_SETUP_REQUIRED",
          status: 400,
          detail: "Set up an authenticator app first.",
        });
      }
      const step = matchTotp(decryptTotpSecret(admin.totpSecret), code, now, admin.totpLastStep);
      if (step === undefined) {
        throw new AppError({
          code: "INVALID_CODE",
          status: 400,
          detail: "That code isn't right. Use the current one from your authenticator app.",
        });
      }

      // Before commit: if Redis is down, nothing is committed and the code stays usable.
      await spendChallenge(nonce);
      await tx.admin.update({
        where: { id: admin.id },
        data: {
          totpLastStep: step,
          totpConfirmedAt: admin.totpConfirmedAt ?? now,
          lastLoginAt: now,
        },
      });
      const session = await createSession(adminSessions, tx, admin.id, device, clock);
      return { admin: adminProfile(admin), session };
    });
  } catch (error) {
    if (error instanceof RedisUnavailableError) throw serviceUnavailable();
    throw error;
  }
};

export const currentAdmin = async (adminId: string) => adminProfile(await activeAdmin(adminId));
