import { createRoute } from "@hono/zod-openapi";
import {
  AcceptAdminInvitation,
  Admin,
  AdminChallenge,
  AdminInvitation,
  AdminSignedIn,
  AdminSignIn,
  CompleteAdminSignIn,
  InviteAdmin,
  StartTotpSetup,
  TotpSetup,
} from "@hagz/contracts";
import {
  ADMIN_COOKIE_AUTH,
  ADMIN_CSRF_HEADER,
  adminRefreshToken,
  clearAdminSession,
  requireAdmin,
  requireAdminHeader,
  setAdminSession,
} from "@/platform/http/authenticate";
import { AppError } from "@/platform/errors/app-error";
import { createRouter, problemResponse } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import { acceptAdminInvitation, inviteAdmin } from "../application/admin-invitations";
import {
  completeAdminSignIn,
  currentAdmin,
  signInAdmin,
  startTotpSetup,
} from "../application/admin-sign-in";
import { adminSessions } from "../application/accounts";
import { refreshSession, revokeByRefreshToken } from "../application/sessions";
import { body, device, json } from "./route-helpers";

const tags = ["Admin auth"];
const security = [{ [ADMIN_COOKIE_AUTH]: [] }];
const headerMissing = `ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`;
const unauthenticated = problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in.");
const sessionCookies = {
  "Set-Cookie": {
    description: "The access and refresh cookies (httpOnly; the web app never reads them).",
    schema: { type: "string" as const },
  },
};
const rateLimited = problemResponse("RATE_LIMITED: see `retryAfter`.");

const signIn = createRoute({
  method: "post",
  path: "/auth/admin/sessions",
  tags,
  summary: "Check email and password",
  description:
    "Always followed by a code from the authenticator app (set up first if `TOTP_SETUP`).",
  request: body(AdminSignIn),
  responses: {
    200: { description: "Password right; ask for a code", ...json(AdminChallenge) },
    401: problemResponse(
      "INVALID_CREDENTIALS: the same for an unknown email and a wrong password.",
    ),
    403: problemResponse("ACCOUNT_SUSPENDED"),
    429: rateLimited,
  },
});

const totpSetup = createRoute({
  method: "post",
  path: "/auth/admin/sessions/totp-setup",
  tags,
  summary: "Get a new authenticator secret",
  description:
    "Only for accounts without a confirmed authenticator. Asking again replaces the secret; the " +
    "first code accepted from it confirms it.",
  request: body(StartTotpSetup),
  responses: {
    200: { description: "Show the URI as a QR code", ...json(TotpSetup) },
    401: problemResponse("CHALLENGE_EXPIRED: sign in again."),
    403: problemResponse("ACCOUNT_SUSPENDED"),
    409: problemResponse("TOTP_ALREADY_SET_UP"),
  },
});

const completeSignIn = createRoute({
  method: "post",
  path: "/auth/admin/sessions/totp",
  tags,
  summary: "Finish signing in with an authenticator code",
  description: "Sets the session cookies. The session lasts 12 hours and isn't extended.",
  request: body(CompleteAdminSignIn),
  responses: {
    201: { description: "Signed in", headers: sessionCookies, ...json(AdminSignedIn) },
    400: problemResponse("INVALID_CODE or TOTP_SETUP_REQUIRED"),
    401: problemResponse("CHALLENGE_EXPIRED: sign in again (each challenge works once)."),
    403: problemResponse("ACCOUNT_SUSPENDED"),
    429: rateLimited,
    503: problemResponse("SERVICE_UNAVAILABLE: retry with the same code if it's still current."),
  },
});

const refresh = createRoute({
  method: "post",
  path: "/auth/admin/sessions/refresh",
  tags,
  summary: "Renew the access cookie",
  description:
    "Uses the refresh cookie and rotates it. Send one refresh at a time. The session still ends " +
    "12 hours after sign-in.",
  middleware: [requireAdminHeader] as const,
  security,
  responses: {
    204: { description: "New cookies set", headers: sessionCookies },
    401: problemResponse("SESSION_ENDED: sign in again."),
    403: problemResponse(headerMissing),
    503: problemResponse("SERVICE_UNAVAILABLE: retry."),
  },
});

const signOut = createRoute({
  method: "delete",
  path: "/auth/admin/sessions/current",
  tags,
  summary: "Sign out",
  description: "Ends the session the refresh cookie belongs to and clears both cookies.",
  middleware: [requireAdminHeader] as const,
  security,
  responses: {
    204: { description: "Signed out" },
    403: problemResponse(headerMissing),
  },
});

const me = createRoute({
  method: "get",
  path: "/auth/admin/me",
  tags,
  summary: "The signed-in admin",
  middleware: [requireAdmin] as const,
  security,
  responses: {
    200: { description: "The admin", ...json(Admin) },
    401: unauthenticated,
    403: problemResponse(`ACCOUNT_SUSPENDED, or ${headerMissing}`),
  },
});

const invite = createRoute({
  method: "post",
  path: "/admin/invitations",
  tags: ["Admins"],
  summary: "Invite someone to become an admin",
  description:
    "Emails a link that works for 48 hours and replaces any earlier invitation to the same email.",
  middleware: [requireAdmin] as const,
  security,
  request: body(InviteAdmin),
  responses: {
    201: { description: "Invitation sent", ...json(AdminInvitation) },
    401: unauthenticated,
    403: problemResponse(headerMissing),
    409: problemResponse("ADMIN_ALREADY_EXISTS"),
    429: rateLimited,
    503: problemResponse("EMAIL_UNAVAILABLE: retry later."),
  },
});

const accept = createRoute({
  method: "post",
  path: "/auth/admin/invitations/accept",
  tags,
  summary: "Create an admin account from an invitation",
  description:
    "The token is in the invitation link's fragment (`#token=`). Continue with " +
    "sessions/totp-setup: the account can't sign in until its authenticator is set up.",
  request: body(AcceptAdminInvitation),
  responses: {
    201: { description: "Account created; set up the authenticator", ...json(AdminChallenge) },
    400: problemResponse("INVITATION_INVALID, or VALIDATION_FAILED"),
    409: problemResponse("ADMIN_ALREADY_EXISTS"),
    429: rateLimited,
  },
});

export const adminAuthRoutes = createRouter()
  .openapi(signIn, async (c) => {
    const { email, password } = c.req.valid("json");
    return c.json(await signInAdmin({ email, password, ip: clientIp(c) }), 200);
  })
  .openapi(totpSetup, async (c) => {
    return c.json(await startTotpSetup(c.req.valid("json").challengeToken), 200);
  })
  .openapi(completeSignIn, async (c) => {
    const { challengeToken, code } = c.req.valid("json");
    const { admin, session } = await completeAdminSignIn({
      challengeToken,
      code,
      device: device(c),
    });
    setAdminSession(c, session);
    return c.json({ admin, sessionExpiresIn: session.refreshTokenExpiresIn }, 201);
  })
  .openapi(refresh, async (c) => {
    try {
      setAdminSession(c, await refreshSession(adminSessions, adminRefreshToken(c) ?? ""));
    } catch (error) {
      // An ended session's cookies are useless; a 503 is retried with them, so they stay.
      if (error instanceof AppError && error.code === "SESSION_ENDED") clearAdminSession(c);
      throw error;
    }
    return c.body(null, 204);
  })
  .openapi(signOut, async (c) => {
    const token = adminRefreshToken(c);
    if (token) await revokeByRefreshToken(adminSessions, token);
    clearAdminSession(c);
    return c.body(null, 204);
  })
  .openapi(me, async (c) => {
    return c.json(await currentAdmin(c.var.admin.adminId), 200);
  })
  .openapi(invite, async (c) => {
    const { email } = c.req.valid("json");
    return c.json(await inviteAdmin({ invitorId: c.var.admin.adminId, email }), 201);
  })
  .openapi(accept, async (c) => {
    const input = c.req.valid("json");
    return c.json(await acceptAdminInvitation({ ...input, ip: clientIp(c) }), 201);
  });
