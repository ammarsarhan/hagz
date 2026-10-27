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

// Venue join codes (staff invitations): 6 characters people may read out or type, so no lookalikes
// (no 0/O, 1/I/L) and case doesn't matter. 31^6 ≈ 887 million; accepting also needs the invitee's
// verified phone to match, so guessing one is useless. Stored with hashCode, so typed codes can be
// looked up.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const generateJoinCode = (): string =>
  Array.from({ length: 6 }, () =>
    JOIN_CODE_ALPHABET.charAt(randomInt(JOIN_CODE_ALPHABET.length)),
  ).join("");

// What people type: any case, with spaces or dashes.
export const normalizeJoinCode = (input: string): string =>
  input.replace(/[\s-]/g, "").toUpperCase();
