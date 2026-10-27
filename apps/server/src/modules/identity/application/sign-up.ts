import type { Language } from "@/generated/prisma/enums";
import { linkWalkIns } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword } from "@/platform/crypto/passwords";
import { violatedUniqueIndex } from "@/platform/db/errors";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { customers, profile, staff, type Account, type AccountStore } from "./accounts";
import { createSession, type Authenticated, type DeviceInfo } from "./sessions";
import { discardVerificationToken, verifiedPhone } from "./verification-codes";

export interface SignUpInput {
  verificationToken: string;
  name: string;
  password: string;
  language: Language;
  device: DeviceInfo;
}

interface NewAccount {
  name: string;
  phone: string;
  passwordHash: string;
  phoneVerifiedAt: Date;
  lastLoginAt: Date;
  language: Language;
}

const signUp = async (
  store: AccountStore,
  { verificationToken, name, password, language, device }: SignUpInput,
  create: (tx: Tx, account: NewAccount) => Promise<Account>,
  clock: Clock,
): Promise<Authenticated> => {
  const phone = await verifiedPhone(store.type, verificationToken);
  // Slow on purpose (argon2), so it happens before the transaction holds a connection.
  const passwordHash = await hashPassword(password);
  const now = clock.now();

  try {
    const result = await transaction(async (tx) => {
      const account = await create(tx, {
        name,
        phone,
        passwordHash,
        phoneVerifiedAt: now,
        lastLoginAt: now,
        language,
      });
      const session = await createSession(store, tx, account.id, device, clock);
      return { account: profile(account), session };
    });
    await discardVerificationToken(store.type, verificationToken);
    return result;
  } catch (error) {
    if (violatedUniqueIndex(error) === store.phoneIndex) {
      throw new AppError({
        code: "PHONE_ALREADY_REGISTERED",
        status: 409,
        detail: "This number already has an account. Log in instead.",
      });
    }
    throw error;
  }
};

const isTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export const signUpCustomer = async (
  { timezone, ...input }: SignUpInput & { timezone: string },
  clock: Clock = systemClock,
) => {
  if (!isTimeZone(timezone)) {
    throw validationFailed([
      { in: "json", path: "timezone", code: "invalid_timezone", message: "Unknown IANA time zone" },
    ]);
  }
  return signUp(
    customers,
    input,
    async (tx, account) => {
      const customer = await tx.customer.create({ data: { ...account, timezone } });
      await linkWalkIns(tx, account.phone, customer.id);
      return customer;
    },
    clock,
  );
};

// A staff account belongs to no venue yet: it creates one or accepts an invitation next.
export const signUpStaff = (input: SignUpInput, clock: Clock = systemClock) =>
  signUp(staff, input, (tx, account) => tx.staff.create({ data: account }), clock);
