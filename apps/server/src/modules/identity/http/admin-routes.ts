import {
  adminRefreshToken,
  clearAdminSession,
  setAdminSession,
} from "@/platform/http/authenticate";
import { AppError } from "@/platform/errors/app-error";
import { createRouter } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import {
  acceptAdminInvitation,
  inviteAdmin,
  listAdminInvitations,
  revokeAdminInvitation,
} from "../application/admin-invitations";
import {
  completeAdminSignIn,
  currentAdmin,
  signInAdmin,
  startTotpSetup,
} from "../application/admin-sign-in";
import { adminSessions } from "../application/accounts";
import { changeAdminPassword, updateAdminProfile } from "../application/admin-account";
import {
  confirmAdminPasswordReset,
  requestAdminPasswordReset,
  resetAdminAuthenticator,
} from "../application/admin-resets";
import { getAdmin, listAdmins } from "../application/admins";
import { refreshSession, revokeByRefreshToken } from "../application/sessions";
import { device } from "./route-helpers";
import * as route from "./definitions/admin";

export const adminAuthRoutes = createRouter()
  .openapi(route.signIn, async (c) => {
    const { email, password } = c.req.valid("json");
    return c.json(await signInAdmin({ email, password, ip: clientIp(c) }), 200);
  })
  .openapi(route.totpSetup, async (c) => {
    return c.json(await startTotpSetup(c.req.valid("json").challengeToken), 200);
  })
  .openapi(route.completeSignIn, async (c) => {
    const { challengeToken, code } = c.req.valid("json");
    const { admin, session } = await completeAdminSignIn({
      challengeToken,
      code,
      device: device(c),
    });
    // Signing in again from a browser that already has a session (the sign-in page stays open to
    // signed-in admins): the new cookies replace the old ones, so end the old session rather than
    // leave it valid and unreachable until it expires. Only after the new sign-in has succeeded, so
    // a failed attempt never signs anyone out.
    const previous = adminRefreshToken(c);
    if (previous) await revokeByRefreshToken(adminSessions, previous);
    setAdminSession(c, session);
    return c.json({ admin, sessionExpiresIn: session.refreshTokenExpiresIn }, 201);
  })
  .openapi(route.refresh, async (c) => {
    try {
      setAdminSession(c, await refreshSession(adminSessions, adminRefreshToken(c) ?? ""));
    } catch (error) {
      // An ended session's cookies are useless; a 503 is retried with them, so they stay.
      if (error instanceof AppError && error.code === "SESSION_ENDED") clearAdminSession(c);
      throw error;
    }
    return c.body(null, 204);
  })
  .openapi(route.signOut, async (c) => {
    const token = adminRefreshToken(c);
    if (token) await revokeByRefreshToken(adminSessions, token);
    clearAdminSession(c);
    return c.body(null, 204);
  })
  .openapi(route.me, async (c) => {
    return c.json(await currentAdmin(c.var.admin.adminId), 200);
  })
  .openapi(route.updateMe, async (c) => {
    return c.json(await updateAdminProfile(c.var.admin.adminId, c.req.valid("json")), 200);
  })
  .openapi(route.changePassword, async (c) => {
    await changeAdminPassword(c.var.admin, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.invite, async (c) => {
    const { email } = c.req.valid("json");
    return c.json(await inviteAdmin({ invitorId: c.var.admin.adminId, email }), 201);
  })
  .openapi(route.admins, async (c) => {
    return c.json({ data: await listAdmins() }, 200);
  })
  .openapi(route.admin, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getAdmin({ id, sessionId: c.var.admin.sessionId }), 200);
  })
  .openapi(route.resetAuthenticator, async (c) => {
    await resetAdminAuthenticator({ adminId: c.req.valid("param").id, by: c.var.admin.adminId });
    return c.body(null, 204);
  })
  .openapi(route.requestPasswordReset, async (c) => {
    await requestAdminPasswordReset({ adminId: c.req.valid("param").id, by: c.var.admin.adminId });
    return c.body(null, 204);
  })
  .openapi(route.resetPassword, async (c) => {
    const { token, password } = c.req.valid("json");
    await confirmAdminPasswordReset({ token, password, ip: clientIp(c) });
    return c.body(null, 204);
  })
  .openapi(route.invitations, async (c) => {
    return c.json({ data: await listAdminInvitations() }, 200);
  })
  .openapi(route.revokeInvitation, async (c) => {
    await revokeAdminInvitation(c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(route.accept, async (c) => {
    const input = c.req.valid("json");
    return c.json(await acceptAdminInvitation({ ...input, ip: clientIp(c) }), 201);
  });
