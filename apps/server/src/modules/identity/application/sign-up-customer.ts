import type { CustomerSignedUp } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword } from "@/platform/crypto/passwords";
import { violatedUniqueIndex } from "@/platform/db/errors";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { createCustomerSession, type DeviceInfo } from "./sessions";
import { discardVerificationToken, verifiedPhone } from "./verification-codes";

export interface CustomerSignUpInput {
  verificationToken: string;
  name: string;
  password: string;
  timezone: string;
  language: Language;
  device: DeviceInfo;
}

const isTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export const signUpCustomer = async (
  { verificationToken, name, password, timezone, language, device }: CustomerSignUpInput,
  clock: Clock = systemClock,
): Promise<CustomerSignedUp> => {
  if (!isTimeZone(timezone)) {
    throw validationFailed([
      { in: "json", path: "timezone", code: "invalid_timezone", message: "Unknown IANA time zone" },
    ]);
  }

  const phone = await verifiedPhone("customer", verificationToken);
  // Slow on purpose (argon2), so it happens before the transaction holds a connection.
  const passwordHash = await hashPassword(password);
  const now = clock.now();

  try {
    const result = await transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name,
          phone,
          passwordHash,
          phoneVerifiedAt: now,
          lastLoginAt: now,
          language,
          timezone,
        },
      });
      // The phone is proven, so the venues' walk-in records for it become this account's history.
      await tx.venueCustomer.updateMany({
        where: { phone, customerId: null },
        data: { customerId: customer.id },
      });
      const session = await createCustomerSession(tx, customer.id, device, clock);
      return {
        customer: { id: customer.id, name: customer.name, phone, language: customer.language },
        session,
      };
    });
    await discardVerificationToken("customer", verificationToken);
    return result;
  } catch (error) {
    if (violatedUniqueIndex(error) === "Customer_phone_key") {
      throw new AppError({
        code: "PHONE_ALREADY_REGISTERED",
        status: 409,
        detail: "This number already has an account. Log in instead.",
      });
    }
    throw error;
  }
};
