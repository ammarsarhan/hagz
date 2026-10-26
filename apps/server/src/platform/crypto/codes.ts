import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/platform/config/env";

// One-time codes sent over WhatsApp: 6 digits, so the space is tiny (10^6). They are stored only as an
// HMAC with a server-side pepper, so a leaked database or Redis dump can't be brute-forced offline.
export const CODE_LENGTH = 6;

export const generateCode = (): string =>
  randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, "0");

export const hashCode = (code: string): string =>
  createHmac("sha256", env.OTP_PEPPER).update(code).digest("base64url");

// Constant-time, so response timing doesn't reveal how much of a guess was right.
export const codeMatches = (code: string, hash: string): boolean => {
  const expected = Buffer.from(hash, "base64url");
  const actual = Buffer.from(hashCode(code), "base64url");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
