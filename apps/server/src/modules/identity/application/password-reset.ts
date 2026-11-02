import type { Language } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword } from "@/platform/crypto/passwords";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import { messaging } from "@/platform/messaging/messaging";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { parseMobileNumber, requireMobileNumber } from "@/platform/phone/phone";
import { consume } from "@/platform/rate-limit/rate-limit";
import {
  CODE_TTL_SECONDS,
  limits,
  RESEND_AFTER_SECONDS,
  RESET_TOKEN_TTL_SECONDS,
} from "../domain/policy";
import { codeExpired, consumeCode, issueCode } from "./account-codes";
import type { Account, AccountStore } from "./accounts";
import { accountSuspended } from "./sessions";
import { discardVerificationToken, redis, verifiedPhone } from "./verification-codes";

// The same answer for every number. A code goes out only to an active account that may reset by
// itself; one that resets through support (a venue owner) gets a WhatsApp message saying so
// instead, so the right path reaches the right person without the app being told. Limits and the
// cooldown apply before the lookup so they can't tell numbers apart either.
// (Timing still differs slightly while sending is synchronous; it moves to the queue with
// notifications.)
export const requestPasswordReset = async (
  store: AccountStore,
  { phone: input, ip }: { phone: string; ip: string; language: Language },
) => {
  const phone = requireMobileNumber(input).e164;
  await consume(limits.accountCodePerIp, ip);
  await consume(limits.accountCodePerPhone, phone);
  await consume(limits.accountCodeCooldown, `${store.type}:${phone}`);

  const account = await store.findByPhone(phone);
  if (account?.status === "ACTIVE") {
    // In the account's language, not the request's: it's their phone.
    if (await store.selfServiceReset(account)) {
      await issueCode(store, {
        accountId: account.id,
        phone,
        purpose: "PASSWORD_RESET",
        language: account.language,
      });
    } else {
      await messaging.sendSupportResetNotice({ phone, language: account.language });
    }
  }
  return { expiresIn: CODE_TTL_SECONDS, resendAfter: RESEND_AFTER_SECONDS };
};

// Verifying and setting the password are two steps, so the app can check the code on its own screen
// before asking for the new password. Verifying returns a short-lived reset token for that account.
const resetTokenKey = (type: AccountStore["type"], token: string) =>
  `reset:${type}:${hashToken(token)}`;

const resetExpired = () =>
  new AppError({
    code: "RESET_TOKEN_INVALID",
    status: 400,
    detail: "This reset has expired or was already used. Start again.",
  });

const throughSupport = () =>
  new AppError({
    code: "PASSWORD_RESET_THROUGH_SUPPORT",
    status: 403,
    detail: "Venue owners reset their password through Hagz support.",
  });

const issueResetToken = async (store: AccountStore, account: Account) => {
  const resetToken = randomToken();
  await redis((r) =>
    r.set(resetTokenKey(store.type, resetToken), account.id, "EX", RESET_TOKEN_TTL_SECONDS),
  );
  return { resetToken, expiresIn: RESET_TOKEN_TTL_SECONDS };
};

export type ResetProof = { phone: string; code: string } | { verificationToken: string };

// Proves the reset with the code sent to the phone, or with a sign-up verification of the same
// number (someone who has just confirmed their number at sign-up and learnt it has an account
// shouldn't need a second code). With a code, every refusal looks like a wrong or expired code. With
// a verification the caller has already proved they hold the number, so it can say why: suspended,
// or an owner who resets through support.
export const verifyPasswordReset = async (
  store: AccountStore,
  proof: ResetProof,
  { ip }: { ip: string },
  clock: Clock = systemClock,
) => {
  await consume(limits.accountCodeConfirmPerIp, ip);

  if ("verificationToken" in proof) {
    const phone = await verifiedPhone(store.type, proof.verificationToken);
    const account = await store.findByPhone(phone);
    if (!account) throw resetExpired();
    if (account.status !== "ACTIVE") throw accountSuspended();
    if (!(await store.selfServiceReset(account))) throw throughSupport();
    await discardVerificationToken(store.type, proof.verificationToken);
    return issueResetToken(store, account);
  }

  const phone = parseMobileNumber(proof.phone)?.e164;
  const account = phone ? await store.findByPhone(phone) : null;
  // No account and no open code look the same. Checked again here: someone may have become an owner
  // since the code was sent.
  if (account?.status !== "ACTIVE" || !(await store.selfServiceReset(account))) throw codeExpired();
  await consumeCode(
    store,
    { accountId: account.id, purpose: "PASSWORD_RESET", code: proof.code },
    clock,
  );
  return issueResetToken(store, account);
};

// Sets the new password and ends every session: whoever else was signed in is signed out. Checked
// once more, as the account may have been suspended or become an owner since it was verified.
export const confirmPasswordReset = async (
  store: AccountStore,
  { resetToken, newPassword }: { resetToken: string; newPassword: string },
  clock: Clock = systemClock,
) => {
  const key = resetTokenKey(store.type, resetToken);
  const accountId = await redis((r) => r.get(key));
  const account = accountId ? await store.findById(accountId) : null;
  if (account?.status !== "ACTIVE" || !(await store.selfServiceReset(account)))
    throw resetExpired();

  const passwordHash = await hashPassword(newPassword);
  await transaction(async (tx) => {
    await store.update(tx, account.id, { passwordHash });
    await store.sessions.revoke(tx, account.id, clock.now());
    await store.afterPasswordReset(tx, account, clock);
  });
  await redis((r) => r.del(key));
};
