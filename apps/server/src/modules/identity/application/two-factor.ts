import type { TwoFactorChallenge } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { signJwt, verifyJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { consume } from "@/platform/rate-limit/rate-limit";
import { limits, TWO_FACTOR_CHALLENGE_TTL_SECONDS } from "../domain/policy";
import { consumeCode, issueCode } from "./account-codes";
import type { Account, AccountStore } from "./accounts";
import { accountSuspended, openSession, type Authenticated, type DeviceInfo } from "./sessions";

// Two-factor here is a WhatsApp code to the account's phone after the password.

const challengeAudience = (store: AccountStore) => `${store.type}-challenge` as const;

const challengeFor = async (
  store: AccountStore,
  account: Account,
  clock: Clock,
): Promise<TwoFactorChallenge> => {
  const issued = await issueCode(
    store,
    {
      accountId: account.id,
      phone: account.phone ?? "",
      purpose: "TWO_FACTOR",
      language: account.language,
    },
    clock,
  );
  // Bound to the exact code that was sent, so a code completes only the sign-in it was issued for.
  const challengeToken = await signJwt(
    { sub: account.id, sid: issued.verificationId },
    { audience: challengeAudience(store), ttlSeconds: TWO_FACTOR_CHALLENGE_TTL_SECONDS },
    clock,
  );
  return {
    twoFactorRequired: true,
    challengeToken,
    expiresIn: issued.expiresIn,
    resendAfter: issued.resendAfter,
  };
};

export const startTwoFactorSignIn = (
  store: AccountStore,
  account: Account,
  clock: Clock = systemClock,
) => challengeFor(store, account, clock);

const readChallenge = async (store: AccountStore, challengeToken: string, clock: Clock) => {
  try {
    return await verifyJwt(challengeToken, challengeAudience(store), clock);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    throw new AppError({
      code: "CHALLENGE_EXPIRED",
      status: 401,
      detail: "This sign-in took too long. Please sign in again.",
    });
  }
};

const activeAccount = async (store: AccountStore, accountId: string) => {
  const account = await store.findById(accountId);
  if (account?.status !== "ACTIVE") throw accountSuspended();
  return account;
};

export const completeTwoFactorSignIn = async (
  store: AccountStore,
  { challengeToken, code, device }: { challengeToken: string; code: string; device: DeviceInfo },
  clock: Clock = systemClock,
): Promise<Authenticated> => {
  await consume(limits.accountCodeConfirmPerIp, device.ip);
  const { sub: accountId, sid: verificationId } = await readChallenge(store, challengeToken, clock);
  await consumeCode(store, { accountId, purpose: "TWO_FACTOR", code, verificationId }, clock);
  return openSession(store, await activeAccount(store, accountId), device, clock);
};

// A new code means a new challenge token: the old one was bound to the old code.
export const resendTwoFactorSignIn = async (
  store: AccountStore,
  challengeToken: string,
  ip: string,
  clock: Clock = systemClock,
) => {
  await consume(limits.accountCodePerIp, ip);
  const { sub } = await readChallenge(store, challengeToken, clock);
  return challengeFor(store, await activeAccount(store, sub), clock);
};

// Turning two-factor on or off needs a code too, so a stolen access token alone can't change it.
export const sendTwoFactorSettingCode = async (
  store: AccountStore,
  accountId: string,
  ip: string,
  clock: Clock = systemClock,
) => {
  await consume(limits.accountCodePerIp, ip);
  const account = await activeAccount(store, accountId);
  const { expiresIn, resendAfter } = await issueCode(
    store,
    { accountId, phone: account.phone ?? "", purpose: "TWO_FACTOR", language: account.language },
    clock,
  );
  return { expiresIn, resendAfter };
};

export const changeTwoFactor = async (
  store: AccountStore,
  {
    accountId,
    enabled,
    code,
    ip,
  }: { accountId: string; enabled: boolean; code: string; ip: string },
  clock: Clock = systemClock,
) => {
  await consume(limits.accountCodeConfirmPerIp, ip);
  await consumeCode(store, { accountId, purpose: "TWO_FACTOR", code }, clock);
  await store.update(prisma, accountId, { twoFactorEnabled: enabled });
  return { enabled };
};
