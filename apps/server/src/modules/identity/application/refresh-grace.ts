import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { hashToken } from "@/platform/crypto/tokens";
import { guardedRedis } from "@/platform/redis/guarded";
import type { AccountType } from "../domain/policy";

// After a refresh rotates a session's token, the previous token keeps working for a short while and is
// answered with the same new token, so concurrent refreshes and lost responses don't look like theft.
// The new token is stored encrypted with a key derived from the previous one: only its holder can read
// it, and a Redis dump reveals nothing usable.
export const REFRESH_GRACE_SECONDS = 30;

const key = (type: AccountType, previousSecret: string) =>
  `refresh-grace:${type}:${hashToken(previousSecret)}`;
const cipherKey = (previousSecret: string) =>
  createHash("sha256").update(`refresh-grace:${previousSecret}`).digest();

export const rememberRotation = async (
  type: AccountType,
  previousSecret: string,
  newRefreshToken: string,
) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cipherKey(previousSecret), iv);
  const sealed = Buffer.concat([
    iv,
    cipher.update(newRefreshToken, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  await guardedRedis((r) =>
    r.set(key(type, previousSecret), sealed.toString("base64url"), "EX", REFRESH_GRACE_SECONDS),
  );
};

export const forgetRotation = (type: AccountType, previousSecret: string) =>
  guardedRedis((r) => r.del(key(type, previousSecret)));

// The token a rotation of `previousSecret` produced, if it happened within the grace window.
export const rotatedTo = async (
  type: AccountType,
  previousSecret: string,
): Promise<string | undefined> => {
  const stored = await guardedRedis((r) => r.get(key(type, previousSecret)));
  if (stored === null) return undefined;
  const sealed = Buffer.from(stored, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    cipherKey(previousSecret),
    sealed.subarray(0, 12),
  );
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  return Buffer.concat([
    decipher.update(sealed.subarray(12, sealed.length - 16)),
    decipher.final(),
  ]).toString("utf8");
};
