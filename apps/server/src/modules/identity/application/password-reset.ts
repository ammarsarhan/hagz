import type { Language } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword } from "@/platform/crypto/passwords";
import { transaction } from "@/platform/db/transaction";
import { parseMobileNumber, requireMobileNumber } from "@/platform/phone/phone";
import { consume } from "@/platform/rate-limit/rate-limit";
import { CODE_TTL_SECONDS, limits, RESEND_AFTER_SECONDS } from "../domain/policy";
import { codeExpired, consumeCode, issueCode } from "./account-codes";
import type { AccountStore } from "./accounts";

// The same answer for every number. A code goes out only to an active account that may reset by
// itself; limits and the cooldown apply before the lookup so they can't tell numbers apart either.
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
  if (account?.status === "ACTIVE" && (await store.selfServiceReset(account))) {
    // In the account's language, not the request's: it's their phone.
    await issueCode(store, {
      accountId: account.id,
      phone,
      purpose: "PASSWORD_RESET",
      language: account.language,
    });
  }
  return { expiresIn: CODE_TTL_SECONDS, resendAfter: RESEND_AFTER_SECONDS };
};

// Sets the new password and ends every session: whoever else was signed in is signed out.
export const confirmPasswordReset = async (
  store: AccountStore,
  {
    phone: input,
    code,
    newPassword,
    ip,
  }: { phone: string; code: string; newPassword: string; ip: string },
  clock: Clock = systemClock,
) => {
  await consume(limits.accountCodeConfirmPerIp, ip);
  const phone = parseMobileNumber(input)?.e164;
  const account = phone ? await store.findByPhone(phone) : null;
  // No account and no open code look the same. Checked again here: someone may have become an owner
  // since the code was sent.
  if (account?.status !== "ACTIVE" || !(await store.selfServiceReset(account))) throw codeExpired();

  await consumeCode(store, { accountId: account.id, purpose: "PASSWORD_RESET", code }, clock);
  const passwordHash = await hashPassword(newPassword);
  await transaction(async (tx) => {
    await store.update(tx, account.id, { passwordHash });
    await store.sessions.revoke(tx, account.id, clock.now());
    await store.afterPasswordReset(tx, account, clock);
  });
};
