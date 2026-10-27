import type { Language } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword } from "@/platform/crypto/passwords";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { parseMobileNumber, requireMobileNumber } from "@/platform/phone/phone";
import { consume } from "@/platform/rate-limit/rate-limit";
import { CODE_TTL_SECONDS, limits, RESEND_AFTER_SECONDS } from "../domain/policy";
import { codeExpired, consumeCustomerCode, issueCustomerCode } from "./account-codes";

// The same answer for every number. A code goes out only to an active account; limits and the
// cooldown apply before the lookup so they can't tell numbers apart either. (Timing still differs
// slightly while sending is synchronous; it moves to the queue with notifications.)
export const requestCustomerPasswordReset = async ({
  phone: input,
  ip,
}: {
  phone: string;
  ip: string;
  language: Language;
}) => {
  const phone = requireMobileNumber(input).e164;
  await consume(limits.accountCodePerIp, ip);
  await consume(limits.accountCodePerPhone, phone);
  await consume(limits.accountCodeCooldown, phone);

  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (customer?.status === "ACTIVE") {
    // In the account's language, not the request's: it's their phone.
    await issueCustomerCode({
      customerId: customer.id,
      phone,
      purpose: "PASSWORD_RESET",
      language: customer.language,
    });
  }
  return { expiresIn: CODE_TTL_SECONDS, resendAfter: RESEND_AFTER_SECONDS };
};

// Sets the new password and ends every session: whoever else was signed in is signed out.
export const confirmCustomerPasswordReset = async (
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
  const customer = phone ? await prisma.customer.findUnique({ where: { phone } }) : null;
  // No account and no open code look the same.
  if (customer?.status !== "ACTIVE") throw codeExpired();

  await consumeCustomerCode({ customerId: customer.id, purpose: "PASSWORD_RESET", code }, clock);
  const passwordHash = await hashPassword(newPassword);
  const now = clock.now();
  await transaction(async (tx) => {
    await tx.customer.update({ where: { id: customer.id }, data: { passwordHash } });
    await tx.customerSession.updateMany({
      where: { customerId: customer.id, revokedAt: null },
      data: { revokedAt: now, pushToken: null },
    });
  });
};
