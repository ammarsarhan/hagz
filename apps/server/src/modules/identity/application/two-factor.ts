import type { CustomerAuthenticated, TwoFactorChallenge } from "@hagz/contracts";
import type { Customer } from "@/generated/prisma/client";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { signJwt, verifyJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { consume } from "@/platform/rate-limit/rate-limit";
import { limits, TWO_FACTOR_CHALLENGE_TTL_SECONDS } from "../domain/policy";
import { consumeCustomerCode, issueCustomerCode } from "./account-codes";
import { createCustomerSession, type DeviceInfo } from "./sessions";

// Two-factor here is a WhatsApp code to the account's phone after the password.

const challengeFor = async (customer: Customer, clock: Clock): Promise<TwoFactorChallenge> => {
  const issued = await issueCustomerCode(
    {
      customerId: customer.id,
      phone: customer.phone ?? "",
      purpose: "TWO_FACTOR",
      language: customer.language,
    },
    clock,
  );
  // Bound to the exact code that was sent, so a code completes only the sign-in it was issued for.
  const challengeToken = await signJwt(
    { sub: customer.id, sid: issued.verificationId },
    { audience: "customer-challenge", ttlSeconds: TWO_FACTOR_CHALLENGE_TTL_SECONDS },
    clock,
  );
  return {
    twoFactorRequired: true,
    challengeToken,
    expiresIn: issued.expiresIn,
    resendAfter: issued.resendAfter,
  };
};

export const startTwoFactorSignIn = (customer: Customer, clock: Clock = systemClock) =>
  challengeFor(customer, clock);

const readChallenge = async (challengeToken: string, clock: Clock) => {
  try {
    return await verifyJwt(challengeToken, "customer-challenge", clock);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    throw new AppError({
      code: "CHALLENGE_EXPIRED",
      status: 401,
      detail: "This sign-in took too long. Please sign in again.",
    });
  }
};

const activeCustomer = async (customerId: string) => {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (customer?.status !== "ACTIVE") {
    throw new AppError({
      code: "ACCOUNT_SUSPENDED",
      status: 403,
      detail: "This account can't sign in. Please contact support.",
    });
  }
  return customer;
};

export const completeTwoFactorSignIn = async (
  { challengeToken, code, device }: { challengeToken: string; code: string; device: DeviceInfo },
  clock: Clock = systemClock,
): Promise<CustomerAuthenticated> => {
  await consume(limits.accountCodeConfirmPerIp, device.ip);
  const { sub: customerId, sid: verificationId } = await readChallenge(challengeToken, clock);
  await consumeCustomerCode({ customerId, purpose: "TWO_FACTOR", code, verificationId }, clock);
  const customer = await activeCustomer(customerId);

  return transaction(async (tx) => {
    await tx.customer.update({ where: { id: customer.id }, data: { lastLoginAt: clock.now() } });
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

// A new code means a new challenge token: the old one was bound to the old code.
export const resendTwoFactorSignIn = async (
  challengeToken: string,
  ip: string,
  clock: Clock = systemClock,
) => {
  await consume(limits.accountCodePerIp, ip);
  const { sub } = await readChallenge(challengeToken, clock);
  return challengeFor(await activeCustomer(sub), clock);
};

// Turning two-factor on or off needs a code too, so a stolen access token alone can't change it.
export const sendTwoFactorSettingCode = async (
  customerId: string,
  ip: string,
  clock: Clock = systemClock,
) => {
  await consume(limits.accountCodePerIp, ip);
  const customer = await activeCustomer(customerId);
  const { expiresIn, resendAfter } = await issueCustomerCode(
    { customerId, phone: customer.phone ?? "", purpose: "TWO_FACTOR", language: customer.language },
    clock,
  );
  return { expiresIn, resendAfter };
};

export const changeTwoFactor = async (
  {
    customerId,
    enabled,
    code,
    ip,
  }: { customerId: string; enabled: boolean; code: string; ip: string },
  clock: Clock = systemClock,
) => {
  await consume(limits.accountCodeConfirmPerIp, ip);
  await consumeCustomerCode({ customerId, purpose: "TWO_FACTOR", code }, clock);
  await prisma.customer.update({ where: { id: customerId }, data: { twoFactorEnabled: enabled } });
  return { enabled };
};
