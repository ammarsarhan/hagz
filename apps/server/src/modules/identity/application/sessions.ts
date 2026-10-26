import type { Session } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { signJwt } from "@/platform/crypto/jwt";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import type { Tx } from "@/platform/db/transaction";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "../domain/policy";

export interface DeviceInfo {
  ip: string;
  userAgent: string | undefined;
}

// The refresh token is "<sessionId>.<secret>", and only the secret's hash is stored. The id lets a
// refresh find its session even when the secret is stale, which is how a reused (stolen) token is told
// apart from an unknown one.
export const createCustomerSession = async (
  tx: Tx,
  customerId: string,
  device: DeviceInfo,
  clock: Clock = systemClock,
): Promise<Session> => {
  const secret = randomToken();
  const refreshTtl = REFRESH_TOKEN_TTL_SECONDS.customer;
  const session = await tx.customerSession.create({
    data: {
      customerId,
      refreshTokenHash: hashToken(secret),
      ipAddress: device.ip === "unknown" ? null : device.ip,
      userAgent: device.userAgent?.slice(0, 512) ?? null,
      expiresAt: new Date(clock.now().getTime() + refreshTtl * 1000),
    },
  });
  const accessToken = await signJwt(
    { sub: customerId, sid: session.id },
    { audience: "customer", ttlSeconds: ACCESS_TOKEN_TTL_SECONDS },
    clock,
  );
  return {
    accessToken,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: `${session.id}.${secret}`,
    refreshTokenExpiresIn: refreshTtl,
  };
};
