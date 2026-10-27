import { createRoute } from "@hono/zod-openapi";
import {
  ChangeTwoFactor,
  CompleteTwoFactor,
  ConfirmPasswordReset,
  ConfirmVerificationCode,
  CustomerAuthenticated,
  CustomerSignUp,
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
import { requestLanguage } from "@/platform/http/language";
import { createRouter, problemResponse } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import { customers } from "../application/accounts";
import { confirmPasswordReset, requestPasswordReset } from "../application/password-reset";
import { refreshSession, revokeSession, type Authenticated } from "../application/sessions";
import { signIn } from "../application/sign-in";
import { signUpCustomer } from "../application/sign-up";
import {
  changeTwoFactor,
  completeTwoFactorSignIn,
  resendTwoFactorSignIn,
  sendTwoFactorSettingCode,
} from "../application/two-factor";
import { confirmSignUpCode, sendSignUpCode } from "../application/verification-codes";
import { CUSTOMER_BEARER, requireCustomer } from "./authenticate";
import { body, codeRejected, device, json, unauthenticated, unavailable } from "./route-helpers";

const tags = ["Customer auth"];
const authenticated = ({ account, session }: Authenticated) => ({ customer: account, session });

// Routes that need a signed-in customer also declare `middleware: [requireCustomer] as const`
// inline: spread from a shared object, the route types lose `c.var.customer`.
const customerSecurity = [{ [CUSTOMER_BEARER]: [] }];

const sendCode = createRoute({
  method: "post",
  path: "/auth/customer/verifications",
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

const confirmCode = createRoute({
  method: "post",
  path: "/auth/customer/verifications/confirm",
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

const signUp = createRoute({
  method: "post",
  path: "/auth/customer/sign-up",
  tags,
  summary: "Create the account and sign in",
  description:
    "Needs a `verificationToken` from confirming a code. Language follows `Accept-Language`.",
  request: body(CustomerSignUp),
  responses: {
    201: { description: "Signed up and signed in", ...json(CustomerAuthenticated) },
    400: problemResponse(
      "VERIFICATION_TOKEN_INVALID: verify the number again; or VALIDATION_FAILED.",
    ),
    409: problemResponse("PHONE_ALREADY_REGISTERED: log in instead."),
    503: problemResponse("SERVICE_UNAVAILABLE: retry with the same verificationToken."),
  },
});

const signInWithPassword = createRoute({
  method: "post",
  path: "/auth/customer/sessions",
  tags,
  summary: "Sign in with phone and password",
  description:
    "With two-factor on, a right password returns 200 with a `challengeToken` and sends a code; " +
    "finish with POST sessions/two-factor.",
  request: body(SignIn),
  responses: {
    200: { description: "Password right; a two-factor code was sent", ...json(TwoFactorChallenge) },
    201: { description: "Signed in", ...json(CustomerAuthenticated) },
    401: problemResponse(
      "INVALID_CREDENTIALS: the same for an unknown number and a wrong password.",
    ),
    403: problemResponse("ACCOUNT_SUSPENDED"),
    429: problemResponse("RATE_LIMITED"),
    503: unavailable,
  },
});

const completeTwoFactor = createRoute({
  method: "post",
  path: "/auth/customer/sessions/two-factor",
  tags,
  summary: "Finish a two-factor sign-in with the code",
  request: body(CompleteTwoFactor),
  responses: {
    201: { description: "Signed in", ...json(CustomerAuthenticated) },
    400: codeRejected,
    401: problemResponse("CHALLENGE_EXPIRED: sign in again."),
    403: problemResponse("ACCOUNT_SUSPENDED"),
    429: problemResponse("RATE_LIMITED"),
  },
});

const resendTwoFactor = createRoute({
  method: "post",
  path: "/auth/customer/sessions/two-factor/resend",
  tags,
  summary: "Send another two-factor code",
  description: "Returns a new `challengeToken`: the previous one belonged to the previous code.",
  request: body(ResendTwoFactor),
  responses: {
    202: { description: "A new code was sent", ...json(TwoFactorChallenge) },
    401: problemResponse("CHALLENGE_EXPIRED: sign in again."),
    429: problemResponse("RATE_LIMITED: see `retryAfter`."),
    503: unavailable,
  },
});

const refresh = createRoute({
  method: "post",
  path: "/auth/customer/sessions/refresh",
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

const signOut = createRoute({
  method: "delete",
  path: "/auth/customer/sessions/current",
  tags,
  summary: "Sign out of this device",
  description:
    "The access token keeps working until it expires (at most 10 minutes); the refresh token stops at once.",
  middleware: [requireCustomer] as const,
  security: customerSecurity,
  responses: {
    204: { description: "Signed out" },
    401: unauthenticated,
  },
});

const requestReset = createRoute({
  method: "post",
  path: "/auth/customer/password-resets",
  tags,
  summary: "Send a password reset code",
  description: "The same response whether or not the number has an account.",
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

const confirmReset = createRoute({
  method: "post",
  path: "/auth/customer/password-resets/confirm",
  tags,
  summary: "Set a new password with the reset code",
  description: "Signs out every session; sign in again with the new password.",
  request: body(ConfirmPasswordReset),
  responses: {
    204: { description: "Password changed" },
    400: codeRejected,
    429: problemResponse("RATE_LIMITED"),
  },
});

const sendTwoFactorCode = createRoute({
  method: "post",
  path: "/auth/customer/two-factor/codes",
  tags,
  summary: "Send a code to turn two-factor on or off",
  middleware: [requireCustomer] as const,
  security: customerSecurity,
  responses: {
    202: { description: "Code sent", ...json(VerificationCodeSent) },
    401: unauthenticated,
    429: problemResponse("RATE_LIMITED: see `retryAfter`."),
    503: unavailable,
  },
});

const changeTwoFactorSetting = createRoute({
  method: "put",
  path: "/auth/customer/two-factor",
  tags,
  summary: "Turn two-factor on or off",
  middleware: [requireCustomer] as const,
  security: customerSecurity,
  request: body(ChangeTwoFactor),
  responses: {
    200: { description: "The new setting", ...json(TwoFactorStatus) },
    400: codeRejected,
    401: unauthenticated,
  },
});

export const customerAuthRoutes = createRouter()
  .openapi(sendCode, async (c) => {
    const { phone } = c.req.valid("json");
    const sent = await sendSignUpCode({
      type: "customer",
      phone,
      language: requestLanguage(c),
      ip: clientIp(c),
    });
    return c.json(sent, 202);
  })
  .openapi(confirmCode, async (c) => {
    const { phone, code } = c.req.valid("json");
    return c.json(await confirmSignUpCode({ type: "customer", phone, code, ip: clientIp(c) }), 200);
  })
  .openapi(signUp, async (c) => {
    const input = c.req.valid("json");
    const signedUp = await signUpCustomer({
      ...input,
      language: requestLanguage(c),
      device: device(c),
    });
    return c.json(authenticated(signedUp), 201);
  })
  .openapi(signInWithPassword, async (c) => {
    const { phone, password } = c.req.valid("json");
    const result = await signIn(customers, { phone, password, device: device(c) });
    return "twoFactorRequired" in result ? c.json(result, 200) : c.json(authenticated(result), 201);
  })
  .openapi(completeTwoFactor, async (c) => {
    const { challengeToken, code } = c.req.valid("json");
    const signedIn = await completeTwoFactorSignIn(customers, {
      challengeToken,
      code,
      device: device(c),
    });
    return c.json(authenticated(signedIn), 201);
  })
  .openapi(resendTwoFactor, async (c) => {
    const { challengeToken } = c.req.valid("json");
    return c.json(await resendTwoFactorSignIn(customers, challengeToken, clientIp(c)), 202);
  })
  .openapi(refresh, async (c) => {
    const { refreshToken } = c.req.valid("json");
    return c.json(await refreshSession(customers, refreshToken), 200);
  })
  .openapi(signOut, async (c) => {
    const { customerId, sessionId } = c.var.customer;
    await revokeSession(customers, customerId, sessionId);
    return c.body(null, 204);
  })
  .openapi(requestReset, async (c) => {
    const { phone } = c.req.valid("json");
    const sent = await requestPasswordReset(customers, {
      phone,
      ip: clientIp(c),
      language: requestLanguage(c),
    });
    return c.json(sent, 202);
  })
  .openapi(confirmReset, async (c) => {
    const { phone, code, newPassword } = c.req.valid("json");
    await confirmPasswordReset(customers, { phone, code, newPassword, ip: clientIp(c) });
    return c.body(null, 204);
  })
  .openapi(sendTwoFactorCode, async (c) => {
    const { customerId } = c.var.customer;
    return c.json(await sendTwoFactorSettingCode(customers, customerId, clientIp(c)), 202);
  })
  .openapi(changeTwoFactorSetting, async (c) => {
    const { enabled, code } = c.req.valid("json");
    const { customerId } = c.var.customer;
    const changed = await changeTwoFactor(customers, {
      accountId: customerId,
      enabled,
      code,
      ip: clientIp(c),
    });
    return c.json(changed, 200);
  });

customerAuthRoutes.openAPIRegistry.registerComponent("securitySchemes", CUSTOMER_BEARER, {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "The access token from sign-up, sign-in or refresh.",
});
