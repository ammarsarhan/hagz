import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import { profile, staff } from "../application/accounts";
import {
  confirmPasswordReset,
  requestPasswordReset,
  verifyPasswordReset,
} from "../application/password-reset";
import {
  refreshSession,
  revokeSession,
  sessionEnded,
  type Authenticated,
} from "../application/sessions";
import { signIn } from "../application/sign-in";
import { signUpStaff } from "../application/sign-up";
import {
  changeTwoFactor,
  completeTwoFactorSignIn,
  resendTwoFactorSignIn,
  sendTwoFactorSettingCode,
} from "../application/two-factor";
import { confirmSignUpCode, sendSignUpCode } from "../application/verification-codes";
import { device } from "./route-helpers";
import * as route from "./definitions/staff";

const authenticated = ({ account, session }: Authenticated) => ({ staff: account, session });

export const staffAuthRoutes = createRouter()
  .openapi(route.sendCode, async (c) => {
    const { phone } = c.req.valid("json");
    const sent = await sendSignUpCode({
      type: "staff",
      phone,
      language: requestLanguage(c),
      ip: clientIp(c),
    });
    return c.json(sent, 202);
  })
  .openapi(route.confirmCode, async (c) => {
    const { phone, code } = c.req.valid("json");
    return c.json(await confirmSignUpCode({ type: "staff", phone, code, ip: clientIp(c) }), 200);
  })
  .openapi(route.signUp, async (c) => {
    const input = c.req.valid("json");
    const signedUp = await signUpStaff({
      ...input,
      language: requestLanguage(c),
      device: device(c),
    });
    return c.json(authenticated(signedUp), 201);
  })
  .openapi(route.signInWithPassword, async (c) => {
    const { phone, password } = c.req.valid("json");
    const result = await signIn(staff, { phone, password, device: device(c) });
    return "twoFactorRequired" in result ? c.json(result, 200) : c.json(authenticated(result), 201);
  })
  .openapi(route.completeTwoFactor, async (c) => {
    const { challengeToken, code } = c.req.valid("json");
    const signedIn = await completeTwoFactorSignIn(staff, {
      challengeToken,
      code,
      device: device(c),
    });
    return c.json(authenticated(signedIn), 201);
  })
  .openapi(route.resendTwoFactor, async (c) => {
    const { challengeToken } = c.req.valid("json");
    return c.json(await resendTwoFactorSignIn(staff, challengeToken, clientIp(c)), 202);
  })
  .openapi(route.refresh, async (c) => {
    const { refreshToken } = c.req.valid("json");
    return c.json(await refreshSession(staff, refreshToken), 200);
  })
  .openapi(route.signOut, async (c) => {
    const { staffId, sessionId } = c.var.staff;
    await revokeSession(staff, staffId, sessionId);
    return c.body(null, 204);
  })
  .openapi(route.requestReset, async (c) => {
    const { phone } = c.req.valid("json");
    const sent = await requestPasswordReset(staff, {
      phone,
      ip: clientIp(c),
      language: requestLanguage(c),
    });
    return c.json(sent, 202);
  })
  .openapi(route.verifyReset, async (c) => {
    const verified = await verifyPasswordReset(staff, c.req.valid("json"), { ip: clientIp(c) });
    return c.json(verified, 200);
  })
  .openapi(route.confirmReset, async (c) => {
    await confirmPasswordReset(staff, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.me, async (c) => {
    const account = await staff.findById(c.var.staff.staffId);
    // Deleting an account ends its sessions, but an access token is checked by its signature alone
    // and works until it expires: that client has to sign in again.
    if (!account) throw sessionEnded();
    return c.json(profile(account), 200);
  })
  .openapi(route.sendTwoFactorCode, async (c) => {
    const { staffId } = c.var.staff;
    return c.json(await sendTwoFactorSettingCode(staff, staffId, clientIp(c)), 202);
  })
  .openapi(route.changeTwoFactorSetting, async (c) => {
    const { enabled, code } = c.req.valid("json");
    const { staffId } = c.var.staff;
    const changed = await changeTwoFactor(staff, {
      accountId: staffId,
      enabled,
      code,
      ip: clientIp(c),
    });
    return c.json(changed, 200);
  });
