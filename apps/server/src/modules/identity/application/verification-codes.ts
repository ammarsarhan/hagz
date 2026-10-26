import { createHash } from "node:crypto";
import type { Language } from "@/generated/prisma/enums";
import { isMarketplaceCallingCode } from "@/modules/locations";
import { generateCode, hashCode } from "@/platform/crypto/codes";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import { AppError } from "@/platform/errors/app-error";
import { requireMobileNumber } from "@/platform/phone/phone";
import { messaging } from "@/platform/messaging/messaging";
import { consume } from "@/platform/rate-limit/rate-limit";
import { guardedRedis, RedisUnavailableError, serviceUnavailable } from "@/platform/redis/guarded";
import {
  CODE_TTL_SECONDS,
  limits,
  MAX_CODE_ATTEMPTS,
  RESEND_AFTER_SECONDS,
  VERIFICATION_TOKEN_TTL_SECONDS,
  type AccountType,
} from "../domain/policy";

// Sign-up codes, before any account exists, so they live in Redis (the queue instance: no eviction,
// persisted) rather than CustomerVerification/StaffVerification, which need an account. Keys hold only
// hashes, never phones or codes.
const hash = (value: string) => createHash("sha256").update(value).digest("base64url");
const codeKey = (type: AccountType, phone: string) => `otp:${type}:sign-up:${hash(phone)}`;
const cooldownKey = (type: AccountType, phone: string) => `${codeKey(type, phone)}:cooldown`;
const tokenKey = (type: AccountType, token: string) => `otp:${type}:token:${hashToken(token)}`;

// Redis failures are a 503: codes are the way in, so they never fall back to "no check".
const redis = async <T>(command: Parameters<typeof guardedRedis<T>>[0]): Promise<T> => {
  try {
    return await guardedRedis(command);
  } catch (error) {
    if (error instanceof RedisUnavailableError) throw serviceUnavailable();
    throw error;
  }
};

const resendLater = (retryAfter: number) =>
  new AppError({
    code: "RATE_LIMITED",
    status: 429,
    detail: "A code was just sent. Please wait before asking for another.",
    extensions: { retryAfter },
    headers: { "Retry-After": String(retryAfter) },
  });

export interface SendCodeInput {
  type: AccountType;
  phone: string;
  language: Language;
  ip: string;
}

// Sends a sign-up code. Answers the same whether or not the number already has an account; the
// owner of a registered number just learns so at sign-up, after proving the number is theirs.
export const sendSignUpCode = async ({ type, phone: input, language, ip }: SendCodeInput) => {
  const phone = requireMobileNumber(input);
  await consume(limits.sendCodePerIp, ip);
  await consume(limits.sendCodePerPhone, phone.e164);
  if (!(await isMarketplaceCallingCode(phone.callingCode))) {
    await consume(limits.sendCodePerForeignCallingCode, phone.callingCode);
  }

  // The cooldown is claimed first (SET NX), so two quick taps can't both send.
  const cooldown = cooldownKey(type, phone.e164);
  const claimed = await redis((r) => r.set(cooldown, "1", "PX", RESEND_AFTER_SECONDS * 1000, "NX"));
  if (claimed === null) {
    const remaining = await redis((r) => r.pttl(cooldown));
    throw resendLater(Math.max(1, Math.ceil(remaining / 1000)));
  }

  const code = generateCode();
  const key = codeKey(type, phone.e164);
  try {
    // A new code replaces the previous one and resets its attempts.
    await redis((r) =>
      r
        .multi()
        .hset(key, { code: hashCode(code), attempts: 0 })
        .expire(key, CODE_TTL_SECONDS)
        .exec(),
    );
    await messaging.sendVerificationCode({ phone: phone.e164, code, language });
  } catch (error) {
    // Nothing was sent, so don't make the user wait out a cooldown for it.
    await redis((r) => r.del(key, cooldown)).catch(() => undefined);
    throw error;
  }

  return { expiresIn: CODE_TTL_SECONDS, resendAfter: RESEND_AFTER_SECONDS };
};

// One script, so concurrent guesses can't exceed the attempt limit and a right code works only once.
const checkScript = `
local stored = redis.call("HGET", KEYS[1], "code")
if not stored then return { "missing", 0 } end
if stored == ARGV[1] then
  redis.call("DEL", KEYS[1])
  return { "ok", 0 }
end
local attempts = redis.call("HINCRBY", KEYS[1], "attempts", 1)
local remaining = tonumber(ARGV[2]) - attempts
if remaining <= 0 then
  redis.call("DEL", KEYS[1])
  return { "burned", 0 }
end
return { "wrong", remaining }
`;

export interface ConfirmCodeInput {
  type: AccountType;
  phone: string;
  code: string;
  ip: string;
}

// Exchanges a right code for a single-use verification token that proves the caller owns the phone.
export const confirmSignUpCode = async ({ type, phone: input, code, ip }: ConfirmCodeInput) => {
  const phone = requireMobileNumber(input);
  await consume(limits.confirmCodePerIp, ip);

  const [outcome, attemptsLeft] = (await redis((r) =>
    r.eval(checkScript, 1, codeKey(type, phone.e164), hashCode(code), MAX_CODE_ATTEMPTS),
  )) as [string, number];

  if (outcome === "wrong") {
    throw new AppError({
      code: "INVALID_CODE",
      status: 400,
      detail: "That code isn't right.",
      extensions: { attemptsLeft },
    });
  }
  if (outcome !== "ok") {
    throw new AppError({
      code: "CODE_EXPIRED",
      status: 400,
      detail: "This code has expired or was entered wrong too many times. Ask for a new one.",
    });
  }

  const token = randomToken();
  await redis((r) =>
    r.set(tokenKey(type, token), phone.e164, "EX", VERIFICATION_TOKEN_TTL_SECONDS),
  );
  return { verificationToken: token, expiresIn: VERIFICATION_TOKEN_TTL_SECONDS };
};

const invalidToken = () =>
  new AppError({
    code: "VERIFICATION_TOKEN_INVALID",
    status: 400,
    detail: "This verification has expired or was already used. Verify your number again.",
  });

// The phone a verification token proves. Read, not consumed: sign-up deletes it only after the account
// is committed, so a failed attempt can be retried. Two concurrent sign-ups with one token can't both
// succeed: the phone's unique index rejects the second.
export const verifiedPhone = async (type: AccountType, token: string): Promise<string> => {
  const phone = await redis((r) => r.get(tokenKey(type, token)));
  if (phone === null) throw invalidToken();
  return phone;
};

export const discardVerificationToken = (type: AccountType, token: string) =>
  redis((r) => r.del(tokenKey(type, token)));
