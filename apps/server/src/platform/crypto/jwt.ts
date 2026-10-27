import { errors, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { env } from "@/platform/config/env";
import { AppError } from "@/platform/errors/app-error";

// Short-lived signed tokens (access tokens). Verified without a database lookup, so they must expire
// quickly; revocation happens at refresh. Each account type is its own audience, so a customer's token
// is rejected by staff and admin routes even though the signature is valid.
const ISSUER = "hagz";
const ALGORITHM = "HS256";

// "*-challenge" tokens only prove a password was right and a second factor is pending; they are not
// access tokens. Their `sid` is the code that was sent.
export type Audience =
  "customer" | "staff" | "admin" | "customer-challenge" | "staff-challenge" | "admin-challenge";

export interface SignedClaims {
  sub: string;
  // The session the token belongs to, so a revoked session's tokens can be recognised.
  sid: string;
}

export const signJwt = async (
  claims: SignedClaims,
  { audience, ttlSeconds }: { audience: Audience; ttlSeconds: number },
  clock: Clock = systemClock,
): Promise<string> => {
  const [signer] = env.JWT_SIGNING_KEYS;
  if (!signer) throw new Error("No JWT signing key configured");
  const issuedAt = Math.floor(clock.now().getTime() / 1000);
  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: ALGORITHM, kid: signer.kid })
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setSubject(claims.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(signer.key);
};

const unauthenticated = (code: "TOKEN_EXPIRED" | "UNAUTHENTICATED", detail: string) =>
  new AppError({ code, status: 401, detail });

export const verifyJwt = async (
  token: string,
  audience: Audience,
  clock: Clock = systemClock,
): Promise<SignedClaims & JWTPayload> => {
  try {
    const { payload } = await jwtVerify(
      token,
      ({ kid }) => {
        const key = env.JWT_SIGNING_KEYS.find((k) => k.kid === kid)?.key;
        // An unknown kid means a retired key or a forgery; either way the token is no good.
        if (!key) throw new errors.JWSSignatureVerificationFailed("Unknown signing key");
        return key;
      },
      { issuer: ISSUER, audience, algorithms: [ALGORITHM], currentDate: clock.now() },
    );
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      throw new errors.JWTClaimValidationFailed("Missing sub or sid", payload);
    }
    return { ...payload, sub: payload.sub, sid: payload.sid };
  } catch (error) {
    // Expired gets its own code: the app should refresh, not log the user out.
    if (error instanceof errors.JWTExpired) {
      throw unauthenticated("TOKEN_EXPIRED", "The access token has expired. Refresh it.");
    }
    if (error instanceof errors.JOSEError) {
      throw unauthenticated("UNAUTHENTICATED", "The access token is invalid.");
    }
    throw error;
  }
};
