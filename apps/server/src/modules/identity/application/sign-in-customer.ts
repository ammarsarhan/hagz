import type { CustomerAuthenticated } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword, needsRehash, verifyPassword } from "@/platform/crypto/passwords";
import { transaction } from "@/platform/db/transaction";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { parseMobileNumber } from "@/platform/phone/phone";
import { consume } from "@/platform/rate-limit/rate-limit";
import { limits } from "../domain/policy";
import { createCustomerSession, type DeviceInfo } from "./sessions";

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
): Promise<CustomerAuthenticated> => {
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
  const passwordHash = needsRehash(customer.passwordHash)
    ? await hashPassword(password)
    : undefined;

  return transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: clock.now(), ...(passwordHash && { passwordHash }) },
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
