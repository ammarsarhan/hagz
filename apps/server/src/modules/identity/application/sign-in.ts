import type { TwoFactorChallenge } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { hashPassword, needsRehash, verifyPassword } from "@/platform/crypto/passwords";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { parseMobileNumber } from "@/platform/phone/phone";
import { consume } from "@/platform/rate-limit/rate-limit";
import { limits } from "../domain/policy";
import type { AccountStore } from "./accounts";
import { accountSuspended, openSession, type Authenticated, type DeviceInfo } from "./sessions";
import { startTwoFactorSignIn } from "./two-factor";

export interface SignInInput {
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

export const signIn = async (
  store: AccountStore,
  { phone: input, password, device }: SignInInput,
  clock: Clock = systemClock,
): Promise<Authenticated | TwoFactorChallenge> => {
  await consume(limits.signInPerIp, device.ip);
  const phone = parseMobileNumber(input)?.e164;
  if (phone) await consume(limits.signInPerPhone, phone);

  const account = phone ? await store.findByPhone(phone) : null;
  if (!(await verifyPassword(account?.passwordHash, password)) || !account)
    throw invalidCredentials();

  // Only told after the right password, so it can't be used to probe which numbers exist.
  if (account.status !== "ACTIVE") throw accountSuspended();

  // A stronger hashing policy takes effect as people sign in.
  if (needsRehash(account.passwordHash)) {
    await store.update(prisma, account.id, { passwordHash: await hashPassword(password) });
  }

  // The password was right; with two-factor on, the session waits for the code.
  if (account.twoFactorEnabled) return startTwoFactorSignIn(store, account, clock);

  return openSession(store, account, device, clock);
};
