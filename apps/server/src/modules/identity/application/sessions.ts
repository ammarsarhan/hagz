import type { Session } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { signJwt } from "@/platform/crypto/jwt";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { RedisUnavailableError, serviceUnavailable } from "@/platform/redis/guarded";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "../domain/policy";
import { profile, type Account, type AccountStore } from "./accounts";
import { forgetRotation, rememberRotation, rotatedTo } from "./refresh-grace";

export interface DeviceInfo {
  ip: string;
  userAgent: string | undefined;
}

export interface Authenticated {
  account: ReturnType<typeof profile>;
  session: Session;
}

const expiresAt = (store: AccountStore, clock: Clock) =>
  new Date(clock.now().getTime() + REFRESH_TOKEN_TTL_SECONDS[store.type] * 1000);

// The account type is the token's audience, so a customer's token is rejected by staff routes.
const issue = async (
  store: AccountStore,
  {
    accountId,
    sessionId,
    refreshToken,
  }: { accountId: string; sessionId: string; refreshToken: string },
  clock: Clock,
): Promise<Session> => ({
  accessToken: await signJwt(
    { sub: accountId, sid: sessionId },
    { audience: store.type, ttlSeconds: ACCESS_TOKEN_TTL_SECONDS },
    clock,
  ),
  accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
  refreshToken,
  refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS[store.type],
});

// The refresh token is "<sessionId>.<secret>", and only the secret's hash is stored. The id lets a
// refresh find its session even when the secret is stale, which is how a reused (stolen) token is told
// apart from an unknown one.
export const createSession = async (
  store: AccountStore,
  tx: Tx,
  accountId: string,
  device: DeviceInfo,
  clock: Clock = systemClock,
): Promise<Session> => {
  const secret = randomToken();
  const session = await store.sessions.create(tx, accountId, {
    refreshTokenHash: hashToken(secret),
    ipAddress: device.ip === "unknown" ? null : device.ip,
    userAgent: device.userAgent?.slice(0, 512) ?? null,
    expiresAt: expiresAt(store, clock),
  });
  return issue(
    store,
    { accountId, sessionId: session.id, refreshToken: `${session.id}.${secret}` },
    clock,
  );
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

// Rotates the refresh token: the old one stops working (after a short grace) and the session is
// extended. A token that is neither current nor within the grace window has been used before, which
// means it was copied: the whole session is revoked.
export const refreshSession = async (
  store: AccountStore,
  refreshToken: string,
  clock: Clock = systemClock,
): Promise<Session> => {
  const { sessionId, secret } = parse(refreshToken);
  const now = clock.now();

  const outcome = await transaction(async (tx) => {
    // Locked, so concurrent refreshes of one session run one after the other: the second then finds
    // the first's grace entry instead of a mismatch.
    const session = await store.sessions.lock(tx, sessionId);
    if (!session) return { kind: "ended" as const };
    if (session.revokedAt !== null || session.expiresAt <= now || session.status !== "ACTIVE") {
      return { kind: "ended" as const };
    }

    if (session.refreshTokenHash !== hashToken(secret)) {
      return { kind: "stale" as const, accountId: session.accountId };
    }

    const nextSecret = randomToken();
    const next = `${session.id}.${nextSecret}`;
    await store.sessions.rotate(tx, session.id, {
      refreshTokenHash: hashToken(nextSecret),
      expiresAt: expiresAt(store, clock),
      lastUsedAt: now,
    });
    // Before commit, so a refresh waiting on the lock finds it.
    await rememberRotation(store.type, secret, next);
    return { kind: "rotated" as const, accountId: session.accountId, refreshToken: next };
  }).catch(async (error: unknown) => {
    await forgetRotation(store.type, secret).catch(() => undefined);
    if (error instanceof RedisUnavailableError) throw serviceUnavailable();
    throw error;
  });

  if (outcome.kind === "ended") throw sessionEnded();

  const { accountId } = outcome;
  if (outcome.kind === "rotated") {
    return issue(store, { accountId, sessionId, refreshToken: outcome.refreshToken }, clock);
  }

  // Stale: either a concurrent refresh / lost response (within grace), or reuse of an old token.
  let rotated: string | undefined;
  try {
    rotated = await rotatedTo(store.type, secret);
  } catch (error) {
    // Without Redis we can't tell the two apart; never revoke on a guess.
    if (error instanceof RedisUnavailableError) throw serviceUnavailable();
    throw error;
  }
  if (rotated) return issue(store, { accountId, sessionId, refreshToken: rotated }, clock);

  await revokeSession(store, accountId, sessionId, clock);
  logger.warn(
    { sessionId, accountType: store.type, accountId },
    "refresh token reused; session revoked",
  );
  throw sessionEnded();
};

// Idempotent, and scoped to the account so one account can't revoke another's sessions.
export const revokeSession = async (
  store: AccountStore,
  accountId: string,
  sessionId: string,
  clock: Clock = systemClock,
) => {
  await transaction((tx) => store.sessions.revoke(tx, accountId, clock.now(), sessionId));
};

export const accountSuspended = () =>
  new AppError({
    code: "ACCOUNT_SUSPENDED",
    status: 403,
    detail: "This account can't sign in. Please contact support.",
  });

// The last step of every sign-in: record it and open a session.
export const openSession = (
  store: AccountStore,
  account: Account,
  device: DeviceInfo,
  clock: Clock,
): Promise<Authenticated> =>
  transaction(async (tx) => {
    await store.update(tx, account.id, { lastLoginAt: clock.now() });
    const session = await createSession(store, tx, account.id, device, clock);
    return { account: profile(account), session };
  });
