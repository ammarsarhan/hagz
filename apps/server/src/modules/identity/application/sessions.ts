import type { Session } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { signJwt } from "@/platform/crypto/jwt";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { RedisUnavailableError, serviceUnavailable } from "@/platform/redis/guarded";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "../domain/policy";
import { forgetRotation, rememberRotation, rotatedTo } from "./refresh-grace";

export interface DeviceInfo {
  ip: string;
  userAgent: string | undefined;
}

const REFRESH_TTL = REFRESH_TOKEN_TTL_SECONDS.customer;
const expiresAt = (clock: Clock) => new Date(clock.now().getTime() + REFRESH_TTL * 1000);

const accessToken = (customerId: string, sessionId: string, clock: Clock) =>
  signJwt(
    { sub: customerId, sid: sessionId },
    { audience: "customer", ttlSeconds: ACCESS_TOKEN_TTL_SECONDS },
    clock,
  );

// The refresh token is "<sessionId>.<secret>", and only the secret's hash is stored. The id lets a
// refresh find its session even when the secret is stale, which is how a reused (stolen) token is told
// apart from an unknown one.
export const createCustomerSession = async (
  tx: Tx,
  customerId: string,
  device: DeviceInfo,
  clock: Clock = systemClock,
): Promise<Session> => {
  const secret = randomToken();
  const session = await tx.customerSession.create({
    data: {
      customerId,
      refreshTokenHash: hashToken(secret),
      ipAddress: device.ip === "unknown" ? null : device.ip,
      userAgent: device.userAgent?.slice(0, 512) ?? null,
      expiresAt: expiresAt(clock),
    },
  });
  return {
    accessToken: await accessToken(customerId, session.id, clock),
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: `${session.id}.${secret}`,
    refreshTokenExpiresIn: REFRESH_TTL,
  };
};

// One answer for every refresh that can't go ahead (unknown, expired, revoked, reused): the app signs
// in again. Saying which would tell a thief whether reuse was noticed.
const sessionEnded = () =>
  new AppError({
    code: "SESSION_ENDED",
    status: 401,
    detail: "Your session has ended. Please sign in again.",
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parse = (refreshToken: string) => {
  const [sessionId = "", secret = "", ...rest] = refreshToken.split(".");
  // Checked before it reaches Postgres, where a malformed uuid is an error, not "no rows".
  if (!UUID.test(sessionId) || secret === "" || rest.length > 0) throw sessionEnded();
  return { sessionId, secret };
};

interface LockedSession {
  id: string;
  customerId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  status: string;
}

// Rotates the refresh token: the old one stops working (after a short grace) and the session is
// extended. A token that is neither current nor within the grace window has been used before, which
// means it was copied: the whole session is revoked.
export const refreshCustomerSession = async (
  refreshToken: string,
  clock: Clock = systemClock,
): Promise<Session> => {
  const { sessionId, secret } = parse(refreshToken);
  const now = clock.now();

  const outcome = await transaction(async (tx) => {
    // Locked, so concurrent refreshes of one session run one after the other: the second then finds
    // the first's grace entry instead of a mismatch.
    const [session] = await tx.$queryRaw<LockedSession[]>`
      SELECT s.id, s."customerId", s."refreshTokenHash", s."expiresAt", s."revokedAt", c.status
      FROM "CustomerSession" s JOIN "Customer" c ON c.id = s."customerId"
      WHERE s.id = ${sessionId}::uuid
      FOR UPDATE OF s`;
    if (!session) return { kind: "ended" as const };
    if (session.revokedAt !== null || session.expiresAt <= now || session.status !== "ACTIVE") {
      return { kind: "ended" as const };
    }

    if (session.refreshTokenHash !== hashToken(secret)) {
      return { kind: "stale" as const, customerId: session.customerId };
    }

    const nextSecret = randomToken();
    const next = `${session.id}.${nextSecret}`;
    await tx.customerSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashToken(nextSecret),
        expiresAt: expiresAt(clock),
        lastUsedAt: now,
      },
    });
    // Before commit, so a refresh waiting on the lock finds it.
    await rememberRotation("customer", secret, next);
    return { kind: "rotated" as const, customerId: session.customerId, refreshToken: next };
  }).catch(async (error: unknown) => {
    await forgetRotation("customer", secret).catch(() => undefined);
    if (error instanceof RedisUnavailableError) throw serviceUnavailable();
    throw error;
  });

  if (outcome.kind === "ended") throw sessionEnded();

  if (outcome.kind === "rotated") {
    return {
      accessToken: await accessToken(outcome.customerId, sessionId, clock),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: outcome.refreshToken,
      refreshTokenExpiresIn: REFRESH_TTL,
    };
  }

  // Stale: either a concurrent refresh / lost response (within grace), or reuse of an old token.
  let rotated: string | undefined;
  try {
    rotated = await rotatedTo("customer", secret);
  } catch (error) {
    // Without Redis we can't tell the two apart; never revoke on a guess.
    if (error instanceof RedisUnavailableError) throw serviceUnavailable();
    throw error;
  }
  if (rotated) {
    return {
      accessToken: await accessToken(outcome.customerId, sessionId, clock),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: rotated,
      refreshTokenExpiresIn: REFRESH_TTL,
    };
  }

  await revokeCustomerSession(outcome.customerId, sessionId, clock);
  logger.warn(
    { sessionId, customerId: outcome.customerId },
    "refresh token reused; session revoked",
  );
  throw sessionEnded();
};

// Idempotent, and scoped to the customer so one account can't revoke another's sessions.
export const revokeCustomerSession = async (
  customerId: string,
  sessionId: string,
  clock: Clock = systemClock,
) => {
  await transaction((tx) =>
    tx.customerSession.updateMany({
      where: { id: sessionId, customerId, revokedAt: null },
      data: { revokedAt: clock.now(), pushToken: null },
    }),
  );
};
