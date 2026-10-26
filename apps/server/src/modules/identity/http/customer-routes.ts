import { createRoute } from "@hono/zod-openapi";
import {
  ConfirmVerificationCode,
  CustomerAuthenticated,
  CustomerSignIn,
  CustomerSignUp,
  RefreshSession,
  Session,
  SendVerificationCode,
  VerificationCodeSent,
  VerificationConfirmed,
} from "@hagz/contracts";
import type { Context } from "hono";
import { requestLanguage } from "@/platform/http/language";
import { createRouter, problemResponse } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import { revokeCustomerSession, refreshCustomerSession } from "../application/sessions";
import { signInCustomer } from "../application/sign-in-customer";
import { signUpCustomer } from "../application/sign-up-customer";
import { CUSTOMER_BEARER, requireCustomer } from "./authenticate";
import { confirmSignUpCode, sendSignUpCode } from "../application/verification-codes";

const json = <T>(schema: T) => ({ content: { "application/json": { schema } } });
const body = <T>(schema: T) => ({ body: { required: true, ...json(schema) } });
const device = (c: Context) => ({ ip: clientIp(c), userAgent: c.req.header("User-Agent") });

const sendCode = createRoute({
  method: "post",
  path: "/auth/customer/verifications",
  tags: ["Customer auth"],
  summary: "Send a sign-up code over WhatsApp",
  description:
    "The same response whether or not the number has an account. Language follows `Accept-Language`.",
  request: body(SendVerificationCode),
  responses: {
    202: { description: "Code sent", ...json(VerificationCodeSent) },
    400: problemResponse("INVALID_PHONE_NUMBER: not a mobile number in international format."),
    429: problemResponse("RATE_LIMITED: too many codes; see `retryAfter`."),
    503: problemResponse("MESSAGING_UNAVAILABLE or SERVICE_UNAVAILABLE: retry later."),
  },
});

const confirmCode = createRoute({
  method: "post",
  path: "/auth/customer/verifications/confirm",
  tags: ["Customer auth"],
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
  tags: ["Customer auth"],
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

const signIn = createRoute({
  method: "post",
  path: "/auth/customer/sessions",
  tags: ["Customer auth"],
  summary: "Sign in with phone and password",
  request: body(CustomerSignIn),
  responses: {
    201: { description: "Signed in", ...json(CustomerAuthenticated) },
    401: problemResponse(
      "INVALID_CREDENTIALS: the same for an unknown number and a wrong password.",
    ),
    403: problemResponse("ACCOUNT_SUSPENDED"),
    429: problemResponse("RATE_LIMITED"),
    503: problemResponse("SERVICE_UNAVAILABLE: retry later."),
  },
});

const refresh = createRoute({
  method: "post",
  path: "/auth/customer/sessions/refresh",
  tags: ["Customer auth"],
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
  tags: ["Customer auth"],
  summary: "Sign out of this device",
  description:
    "The access token keeps working until it expires (at most 10 minutes); the refresh token stops at once.",
  middleware: [requireCustomer] as const,
  security: [{ [CUSTOMER_BEARER]: [] }],
  responses: {
    204: { description: "Signed out" },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
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
    return c.json(signedUp, 201);
  })
  .openapi(signIn, async (c) => {
    const { phone, password } = c.req.valid("json");
    return c.json(await signInCustomer({ phone, password, device: device(c) }), 201);
  })
  .openapi(refresh, async (c) => {
    const { refreshToken } = c.req.valid("json");
    return c.json(await refreshCustomerSession(refreshToken), 200);
  })
  .openapi(signOut, async (c) => {
    const { customerId, sessionId } = c.var.customer;
    await revokeCustomerSession(customerId, sessionId);
    return c.body(null, 204);
  });

customerAuthRoutes.openAPIRegistry.registerComponent("securitySchemes", CUSTOMER_BEARER, {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "The access token from sign-up, sign-in or refresh.",
});
