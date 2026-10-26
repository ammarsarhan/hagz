import { createRoute } from "@hono/zod-openapi";
import {
  ConfirmVerificationCode,
  CustomerSignedUp,
  CustomerSignUp,
  SendVerificationCode,
  VerificationCodeSent,
  VerificationConfirmed,
} from "@hagz/contracts";
import type { Context } from "hono";
import { requestLanguage } from "@/platform/http/language";
import { createRouter, problemResponse } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import { signUpCustomer } from "../application/sign-up-customer";
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
    201: { description: "Signed up and signed in", ...json(CustomerSignedUp) },
    400: problemResponse(
      "VERIFICATION_TOKEN_INVALID: verify the number again; or VALIDATION_FAILED.",
    ),
    409: problemResponse("PHONE_ALREADY_REGISTERED: log in instead."),
    503: problemResponse("SERVICE_UNAVAILABLE: retry with the same verificationToken."),
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
  });
