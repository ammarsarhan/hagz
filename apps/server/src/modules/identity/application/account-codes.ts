import type { Language, VerificationPurpose } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { codeMatches, generateCode, hashCode } from "@/platform/crypto/codes";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { messaging } from "@/platform/messaging/messaging";
import { CODE_TTL_SECONDS, MAX_CODE_ATTEMPTS, RESEND_AFTER_SECONDS } from "../domain/policy";
import type { AccountStore } from "./accounts";

// Codes for accounts that exist (password reset, two-factor), in CustomerVerification or
// StaffVerification. The same rules as sign-up codes in Redis (verification-codes.ts): hashed, single
// use, five guesses, ten minutes, a minute between sends; the constants are shared so the two can't
// drift. Here Postgres is the source of truth, including for the resend cooldown.

export interface IssuedCode {
  verificationId: string;
  expiresIn: number;
  resendAfter: number;
}

export const issueCode = async (
  store: AccountStore,
  {
    accountId,
    phone,
    purpose,
    language,
  }: { accountId: string; phone: string; purpose: VerificationPurpose; language: Language },
  clock: Clock = systemClock,
): Promise<IssuedCode> => {
  const now = clock.now();
  const code = generateCode();
  const query = { accountId, purpose };

  const verification = await transaction(async (tx) => {
    const latest = await store.codes.latestCreatedAt(tx, query);
    const waitMs = latest ? latest.getTime() + RESEND_AFTER_SECONDS * 1000 - now.getTime() : 0;
    if (waitMs > 0) {
      const retryAfter = Math.ceil(waitMs / 1000);
      throw new AppError({
        code: "RATE_LIMITED",
        status: 429,
        detail: "A code was just sent. Please wait before asking for another.",
        extensions: { retryAfter },
        headers: { "Retry-After": String(retryAfter) },
      });
    }
    // A new code replaces any open one for the same purpose.
    await store.codes.consumeOpen(tx, query, now);
    return store.codes.create(tx, {
      ...query,
      codeHash: hashCode(code),
      expiresAt: new Date(now.getTime() + CODE_TTL_SECONDS * 1000),
    });
  });

  try {
    await messaging.sendVerificationCode({ phone, code, language });
  } catch (error) {
    // Nothing was sent: drop the row so the cooldown doesn't make the user wait for it.
    await store.codes.delete(verification.id).catch(() => undefined);
    throw error;
  }
  return {
    verificationId: verification.id,
    expiresIn: CODE_TTL_SECONDS,
    resendAfter: RESEND_AFTER_SECONDS,
  };
};

export const codeExpired = () =>
  new AppError({
    code: "CODE_EXPIRED",
    status: 400,
    detail: "This code has expired or was entered wrong too many times. Ask for a new one.",
  });

// Checks a code against the open one for `purpose` (or the specific row a challenge was issued for)
// and consumes it. The row is locked, so concurrent guesses can't go past the attempt limit.
export const consumeCode = async (
  store: AccountStore,
  {
    accountId,
    purpose,
    code,
    verificationId,
  }: { accountId: string; purpose: VerificationPurpose; code: string; verificationId?: string },
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  const outcome = await transaction(async (tx) => {
    const open = await store.codes.lockOpen(tx, { accountId, purpose, now, verificationId });
    if (!open) return { kind: "expired" as const };
    if (codeMatches(code, open.codeHash)) {
      await store.codes.update(tx, open.id, { consumedAt: now });
      return { kind: "ok" as const };
    }
    const attempts = open.attempts + 1;
    const burned = attempts >= MAX_CODE_ATTEMPTS;
    await store.codes.update(tx, open.id, { attempts, ...(burned && { consumedAt: now }) });
    return burned
      ? { kind: "expired" as const }
      : { kind: "wrong" as const, attemptsLeft: MAX_CODE_ATTEMPTS - attempts };
  });

  if (outcome.kind === "expired") throw codeExpired();
  if (outcome.kind === "wrong") {
    throw new AppError({
      code: "INVALID_CODE",
      status: 400,
      detail: "That code isn't right.",
      extensions: { attemptsLeft: outcome.attemptsLeft },
    });
  }
};
