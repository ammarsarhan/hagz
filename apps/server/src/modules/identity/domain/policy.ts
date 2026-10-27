// Lifetimes and limits for sign-in, in one place (decided 2026-10-26; see docs/architecture.md).

// Accounts that sign in with a phone; admins sign in with an email. All three have sessions.
export type AccountType = "customer" | "staff";
export type SessionType = AccountType | "admin";

export const CODE_TTL_SECONDS = 10 * 60;
export const RESEND_AFTER_SECONDS = 60;
// A code is burned after this many wrong guesses; a new one must be requested.
export const MAX_CODE_ATTEMPTS = 5;
export const VERIFICATION_TOKEN_TTL_SECONDS = 15 * 60;
// How long a sign-in may wait for its second factor.
export const TWO_FACTOR_CHALLENGE_TTL_SECONDS = CODE_TTL_SECONDS;

export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
export const REFRESH_TOKEN_TTL_SECONDS: Record<SessionType, number> = {
  customer: 60 * 24 * 60 * 60,
  staff: 30 * 24 * 60 * 60,
  admin: 12 * 60 * 60,
};
// Sliding sessions are extended by every refresh. An admin session ends 12 hours after sign-in
// however active it is.
export const SLIDING_SESSIONS: Record<SessionType, boolean> = {
  customer: true,
  staff: true,
  admin: false,
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
  // Every sign-up code, from anywhere: pumping spread over many IPs and numbers stays under each limit
  // above, so this bounds the bill. A few times normal peak; raise it as traffic grows. Not shared with
  // reset and two-factor codes, so a sign-up flood can't lock existing accounts out.
  sendCodeGlobal: { name: "otp:send:global", limit: 1000, windowMs: hours(1) },
  confirmCodePerIp: { name: "otp:confirm:ip", limit: 30, windowMs: minutes(15) },
  // Codes for existing accounts (password reset, two-factor).
  accountCodePerPhone: { name: "account-code:send:phone", limit: 5, windowMs: minutes(15) },
  // Applied before the account is looked up, so registered and unknown numbers hit it alike.
  accountCodeCooldown: {
    name: "account-code:cooldown",
    limit: 1,
    windowMs: RESEND_AFTER_SECONDS * 1000,
  },
  accountCodePerIp: { name: "account-code:send:ip", limit: 20, windowMs: minutes(15) },
  accountCodeConfirmPerIp: { name: "account-code:confirm:ip", limit: 30, windowMs: minutes(15) },
  // Password guessing: per number (one account) and per IP (many accounts).
  signInPerPhone: { name: "sign-in:phone", limit: 10, windowMs: minutes(15) },
  signInPerIp: { name: "sign-in:ip", limit: 30, windowMs: minutes(15) },
  // Admins: stricter, since an admin account can do anything.
  adminSignInPerEmail: { name: "admin:sign-in:email", limit: 5, windowMs: minutes(15) },
  adminSignInPerIp: { name: "admin:sign-in:ip", limit: 20, windowMs: minutes(15) },
  adminTotpPerAdmin: { name: "admin:totp:admin", limit: 5, windowMs: minutes(15) },
  adminTotpPerIp: { name: "admin:totp:ip", limit: 20, windowMs: minutes(15) },
  adminInvitesPerAdmin: { name: "admin:invite:admin", limit: 20, windowMs: hours(24) },
  adminAcceptPerIp: { name: "admin:accept:ip", limit: 10, windowMs: minutes(15) },
} as const;

// How long an emailed admin invitation link works.
export const ADMIN_INVITATION_TTL_SECONDS = 48 * 60 * 60;
