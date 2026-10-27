import type { CustomerAuthenticated, TwoFactorChallenge } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword, needsRehash, verifyPassword } from "@/platform/crypto/passwords";
import { transaction } from "@/platform/db/transaction";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { parseMobileNumber } from "@/platform/phone/phone";
import { consume } from "@/platform/rate-limit/rate-limit";
import { limits } from "../domain/policy";
import { createCustomerSession, type DeviceInfo } from "./sessions";
import { startTwoFactorSignIn } from "./two-factor";

export interface CustomerSignInInput {
  phone: string;
  password: string;
  device: DeviceInfo;
}

// Unknown number, wrong password and malformed number all look the same, and take the same time.
const invalidCredentials = () =>
  new AppError({
    code: "INVALID_CREDENTIALS",
    status: 401,
    detail: "The phone number or password is wrong.",
  });

export const signInCustomer = async (
  { phone: input, password, device }: CustomerSignInInput,
  clock: Clock = systemClock,
): Promise<CustomerAuthenticated | TwoFactorChallenge> => {
  await consume(limits.signInPerIp, device.ip);
  const phone = parseMobileNumber(input)?.e164;
  if (phone) await consume(limits.signInPerPhone, phone);

  const customer = phone ? await prisma.customer.findUnique({ where: { phone } }) : null;
  if (!(await verifyPassword(customer?.passwordHash, password)) || !customer)
    throw invalidCredentials();

  // Only told after the right password, so it can't be used to probe which numbers exist.
  if (customer.status !== "ACTIVE") {
    throw new AppError({
      code: "ACCOUNT_SUSPENDED",
      status: 403,
      detail: "This account can't sign in. Please contact support.",
    });
  }

  // A stronger hashing policy takes effect as people sign in.
  if (needsRehash(customer.passwordHash)) {
    const passwordHash = await hashPassword(password);
    await prisma.customer.update({ where: { id: customer.id }, data: { passwordHash } });
  }

  // The password was right; with two-factor on, the session waits for the code.
  if (customer.twoFactorEnabled) return startTwoFactorSignIn(customer, clock);

  return transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: clock.now() },
    });
    const session = await createCustomerSession(tx, customer.id, device, clock);
    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone ?? "",
        language: customer.language,
      },
      session,
    };
  });
};
