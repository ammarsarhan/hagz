// Lifetimes and limits for sign-in, in one place (decided 2026-10-26; see docs/architecture.md).

export type AccountType = "customer" | "staff";

export const CODE_TTL_SECONDS = 10 * 60;
export const RESEND_AFTER_SECONDS = 60;
// A code is burned after this many wrong guesses; a new one must be requested.
export const MAX_CODE_ATTEMPTS = 5;
export const VERIFICATION_TOKEN_TTL_SECONDS = 15 * 60;

export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
// Sliding: every refresh extends it.
export const REFRESH_TOKEN_TTL_SECONDS: Record<AccountType, number> = {
  customer: 60 * 24 * 60 * 60,
  staff: 30 * 24 * 60 * 60,
};

const minutes = (n: number) => n * 60_000;
const hours = (n: number) => n * 3_600_000;

export const limits = {
  // Codes cost money to send and are the way in, so all of these fail closed.
  sendCodePerPhone: { name: "otp:send:phone", limit: 5, windowMs: minutes(15) },
  sendCodePerIp: { name: "otp:send:ip", limit: 20, windowMs: minutes(15) },
  // Numbers outside our marketplaces share a daily budget per calling code, so a fraud spike from one
  // country is capped without touching Egyptian sign-ups.
  sendCodePerForeignCallingCode: { name: "otp:send:calling-code", limit: 200, windowMs: hours(24) },
  confirmCodePerIp: { name: "otp:confirm:ip", limit: 30, windowMs: minutes(15) },
  // Password guessing: per number (one account) and per IP (many accounts).
  signInPerPhone: { name: "sign-in:phone", limit: 10, windowMs: minutes(15) },
  signInPerIp: { name: "sign-in:ip", limit: 30, windowMs: minutes(15) },
} as const;
