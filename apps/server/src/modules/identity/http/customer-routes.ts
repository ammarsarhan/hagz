import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import { customers } from "../application/accounts";
import {
  confirmPasswordReset,
  requestPasswordReset,
  verifyPasswordReset,
} from "../application/password-reset";
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
import { device } from "./route-helpers";
import * as route from "./definitions/customer";

const authenticated = ({ account, session }: Authenticated) => ({ customer: account, session });

export const customerAuthRoutes = createRouter()
  .openapi(route.sendCode, async (c) => {
    const { phone } = c.req.valid("json");
    const sent = await sendSignUpCode({
      type: "customer",
      phone,
      language: requestLanguage(c),
      ip: clientIp(c),
    });
    return c.json(sent, 202);
  })
  .openapi(route.confirmCode, async (c) => {
    const { phone, code } = c.req.valid("json");
    return c.json(await confirmSignUpCode({ type: "customer", phone, code, ip: clientIp(c) }), 200);
  })
  .openapi(route.signUp, async (c) => {
    const input = c.req.valid("json");
    const signedUp = await signUpCustomer({
      ...input,
      language: requestLanguage(c),
      device: device(c),
    });
    return c.json(authenticated(signedUp), 201);
  })
  .openapi(route.signInWithPassword, async (c) => {
    const { phone, password } = c.req.valid("json");
    const result = await signIn(customers, { phone, password, device: device(c) });
    return "twoFactorRequired" in result ? c.json(result, 200) : c.json(authenticated(result), 201);
  })
  .openapi(route.completeTwoFactor, async (c) => {
    const { challengeToken, code } = c.req.valid("json");
    const signedIn = await completeTwoFactorSignIn(customers, {
      challengeToken,
      code,
      device: device(c),
    });
    return c.json(authenticated(signedIn), 201);
  })
  .openapi(route.resendTwoFactor, async (c) => {
    const { challengeToken } = c.req.valid("json");
    return c.json(await resendTwoFactorSignIn(customers, challengeToken, clientIp(c)), 202);
  })
  .openapi(route.refresh, async (c) => {
    const { refreshToken } = c.req.valid("json");
    return c.json(await refreshSession(customers, refreshToken), 200);
  })
  .openapi(route.signOut, async (c) => {
    const { customerId, sessionId } = c.var.customer;
    await revokeSession(customers, customerId, sessionId);
    return c.body(null, 204);
  })
  .openapi(route.requestReset, async (c) => {
    const { phone } = c.req.valid("json");
    const sent = await requestPasswordReset(customers, {
      phone,
      ip: clientIp(c),
      language: requestLanguage(c),
    });
    return c.json(sent, 202);
  })
  .openapi(route.verifyReset, async (c) => {
    const verified = await verifyPasswordReset(customers, c.req.valid("json"), { ip: clientIp(c) });
    return c.json(verified, 200);
  })
  .openapi(route.confirmReset, async (c) => {
    await confirmPasswordReset(customers, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.sendTwoFactorCode, async (c) => {
    const { customerId } = c.var.customer;
    return c.json(await sendTwoFactorSettingCode(customers, customerId, clientIp(c)), 202);
  })
  .openapi(route.changeTwoFactorSetting, async (c) => {
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
