import { createRoute } from "@hono/zod-openapi";
import {
  ChangeTwoFactor,
  CompleteTwoFactor,
  ConfirmPasswordReset,
  PasswordResetVerified,
  VerifyPasswordReset,
  ConfirmVerificationCode,
  Staff,
  StaffAuthenticated,
  StaffSignUp,
  RefreshSession,
  RequestPasswordReset,
  ResendTwoFactor,
  SendVerificationCode,
  Session,
  SignIn,
  TwoFactorChallenge,
  TwoFactorStatus,
  VerificationCodeSent,
  VerificationConfirmed,
} from "@hagz/contracts";
import { body, json, problemResponse } from "@/platform/http/definitions";
import { STAFF_BEARER, requireStaff } from "@/platform/http/authenticate";
import { codeRejected, unauthenticated, unavailable } from "./shared";

const tags = ["Staff auth"];

// Routes that need signed-in staff also declare `middleware: [requireStaff] as const`
// inline: spread from a shared object, the route types lose `c.var.staff`.
const staffSecurity = [{ [STAFF_BEARER]: [] }];

export const sendCode = createRoute({
  method: "post",
  path: "/auth/staff/verifications",
  tags,
  summary: "Send a sign-up code over WhatsApp",
  description:
    "The same response whether or not the number has an account. Language follows `Accept-Language`.",
  request: body(SendVerificationCode),
  responses: {
    202: { description: "Code sent", ...json(VerificationCodeSent) },
    400: problemResponse("INVALID_PHONE_NUMBER: not a mobile number in international format."),
    429: problemResponse("RATE_LIMITED: too many codes; see `retryAfter`."),
    503: unavailable,
  },
});

export const confirmCode = createRoute({
  method: "post",
  path: "/auth/staff/verifications/confirm",
  tags,
  summary: "Confirm a sign-up code",
  request: body(ConfirmVerificationCode),
  responses: {
    200: { description: "The phone is verified", ...json(VerificationConfirmed) },
    400: problemResponse("INVALID_CODE (with `attemptsLeft`) or CODE_EXPIRED: ask for a new code."),
    429: problemResponse("RATE_LIMITED"),
    503: problemResponse("SERVICE_UNAVAILABLE: retry later."),
  },
});

export const signUp = createRoute({
  method: "post",
  path: "/auth/staff/sign-up",
  tags,
  summary: "Create the account and sign in",
  description:
    "Needs a `verificationToken` from confirming a code. Language follows `Accept-Language`.",
  request: body(StaffSignUp),
  responses: {
    201: { description: "Signed up and signed in", ...json(StaffAuthenticated) },
    400: problemResponse(
      "VERIFICATION_TOKEN_INVALID: verify the number again; or VALIDATION_FAILED.",
    ),
    409: problemResponse("PHONE_ALREADY_REGISTERED: log in instead."),
    503: problemResponse("SERVICE_UNAVAILABLE: retry with the same verificationToken."),
  },
});

export const signInWithPassword = createRoute({
  method: "post",
  path: "/auth/staff/sessions",
  tags,
  summary: "Sign in with phone and password",
  description:
    "With two-factor on, a right password returns 200 with a `challengeToken` and sends a code; " +
    "finish with POST sessions/two-factor.",
  request: body(SignIn),
  responses: {
    200: { description: "Password right; a two-factor code was sent", ...json(TwoFactorChallenge) },
    201: { description: "Signed in", ...json(StaffAuthenticated) },
    401: problemResponse(
      "INVALID_CREDENTIALS: the same for an unknown number and a wrong password.",
    ),
    403: problemResponse("ACCOUNT_SUSPENDED, or ACCOUNT_BANNED when it's permanent"),
    429: problemResponse("RATE_LIMITED"),
    503: unavailable,
  },
});

export const completeTwoFactor = createRoute({
  method: "post",
  path: "/auth/staff/sessions/two-factor",
  tags,
  summary: "Finish a two-factor sign-in with the code",
  request: body(CompleteTwoFactor),
  responses: {
    201: { description: "Signed in", ...json(StaffAuthenticated) },
    400: codeRejected,
    401: problemResponse("CHALLENGE_EXPIRED: sign in again."),
    403: problemResponse("ACCOUNT_SUSPENDED"),
    429: problemResponse("RATE_LIMITED"),
  },
});

export const resendTwoFactor = createRoute({
  method: "post",
  path: "/auth/staff/sessions/two-factor/resend",
  tags,
  summary: "Send another two-factor code",
  description: "Returns a new `challengeToken`: the previous one belonged to the previous code.",
  request: body(ResendTwoFactor),
  responses: {
    202: { description: "A new code was sent", ...json(TwoFactorChallenge) },
    401: problemResponse("CHALLENGE_EXPIRED: sign in again."),
    429: problemResponse(
      "RATE_LIMITED: see `retryAfter`. `codeSent` says whether the last code can still be entered.",
    ),
    503: unavailable,
  },
});

export const refresh = createRoute({
  method: "post",
  path: "/auth/staff/sessions/refresh",
  tags,
  summary: "Exchange the refresh token for a new pair",
  description:
    "The refresh token rotates: store the new one. Send one refresh at a time; for 30 s the previous " +
    "token is still answered with the same new pair, so a lost response can be retried.",
  request: body(RefreshSession),
  responses: {
    200: { description: "A new access and refresh token", ...json(Session) },
    401: problemResponse("SESSION_ENDED: sign in again."),
    503: problemResponse("SERVICE_UNAVAILABLE: retry with the same refresh token."),
  },
});

export const signOut = createRoute({
  method: "delete",
  path: "/auth/staff/sessions/current",
  tags,
  summary: "Sign out of this device",
  description:
    "The access token keeps working until it expires (at most 10 minutes); the refresh token stops at once.",
  middleware: [requireStaff] as const,
  security: staffSecurity,
  responses: {
    204: { description: "Signed out" },
    401: unauthenticated,
  },
});

export const requestReset = createRoute({
  method: "post",
  path: "/auth/staff/password-resets",
  tags,
  summary: "Send a password reset code",
  description:
    "The same response whether or not the number has an account. Venue owners get no code: they " +
    "reset through Hagz support, and get a WhatsApp message saying so (reply in that chat). Warn " +
    "members before the new password is set: a reset makes them read-only at every venue until a " +
    "staff manager restores them.",
  request: body(RequestPasswordReset),
  responses: {
    202: {
      description: "If the number has an account, a code was sent",
      ...json(VerificationCodeSent),
    },
    400: problemResponse("INVALID_PHONE_NUMBER"),
    429: problemResponse("RATE_LIMITED: see `retryAfter`."),
    503: unavailable,
  },
});

export const verifyReset = createRoute({
  method: "post",
  path: "/auth/staff/password-resets/verify",
  tags,
  summary: "Check the reset code, before choosing the new password",
  description:
    "With the code sent to the phone, or with a `verificationToken` from confirming a sign-up code " +
    "for the same number (no second code needed). Returns a `resetToken` for setting the password.",
  request: body(VerifyPasswordReset),
  responses: {
    200: { description: "Verified", ...json(PasswordResetVerified) },
    400: problemResponse(
      "INVALID_CODE (with `attemptsLeft`) or CODE_EXPIRED; VERIFICATION_TOKEN_INVALID or " +
        "RESET_TOKEN_INVALID with a verification token.",
    ),
    403: problemResponse(
      "With a verification token only: ACCOUNT_SUSPENDED, or PASSWORD_RESET_THROUGH_SUPPORT for owners.",
    ),
    429: problemResponse("RATE_LIMITED"),
    503: unavailable,
  },
});

export const confirmReset = createRoute({
  method: "post",
  path: "/auth/staff/password-resets/confirm",
  tags,
  summary: "Set the new password",
  description:
    "Signs out every session, and lowers every permission to at most `view` at each venue the " +
    "member belongs to. The owner and members who manage staff are notified; the previous " +
    "permissions are kept so they can be restored.",
  request: body(ConfirmPasswordReset),
  responses: {
    204: { description: "Password changed" },
    400: problemResponse("RESET_TOKEN_INVALID: verify again."),
    503: unavailable,
  },
});

export const me = createRoute({
  method: "get",
  path: "/staff/me",
  tags: ["Staff"],
  summary: "The signed-in staff member",
  description: "Name, phone and language, for the app to greet and label them after a relaunch.",
  middleware: [requireStaff] as const,
  security: staffSecurity,
  responses: {
    200: { description: "Their profile", ...json(Staff) },
    401: problemResponse(
      "UNAUTHENTICATED, TOKEN_EXPIRED, or SESSION_ENDED (the account is gone): sign in again.",
    ),
  },
});

export const sendTwoFactorCode = createRoute({
  method: "post",
  path: "/auth/staff/two-factor/codes",
  tags,
  summary: "Send a code to turn two-factor on or off",
  middleware: [requireStaff] as const,
  security: staffSecurity,
  responses: {
    202: { description: "Code sent", ...json(VerificationCodeSent) },
    401: unauthenticated,
    429: problemResponse(
      "RATE_LIMITED: see `retryAfter`. `codeSent` says whether the last code can still be entered.",
    ),
    503: unavailable,
  },
});

export const changeTwoFactorSetting = createRoute({
  method: "put",
  path: "/auth/staff/two-factor",
  tags,
  summary: "Turn two-factor on or off",
  middleware: [requireStaff] as const,
  security: staffSecurity,
  request: body(ChangeTwoFactor),
  responses: {
    200: { description: "The new setting", ...json(TwoFactorStatus) },
    400: codeRejected,
    401: unauthenticated,
  },
});
