import { createRoute, z } from "@hono/zod-openapi";
import {
  AcceptAdminInvitation,
  Admin,
  AdminChallenge,
  AdminDetails,
  AdminInvitation,
  AdminListEntry,
  AdminSignedIn,
  AdminSignIn,
  ChangeAdminPassword,
  CompleteAdminSignIn,
  InviteAdmin,
  list,
  ResetAdminPassword,
  StartTotpSetup,
  TotpSetup,
  UpdateAdminProfile,
} from "@hagz/contracts";
import {
  ADMIN_COOKIE_AUTH,
  ADMIN_CSRF_HEADER,
  requireAdmin,
  requireAdminHeader,
} from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

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

export const signIn = createRoute({
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

export const totpSetup = createRoute({
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

export const completeSignIn = createRoute({
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

export const refresh = createRoute({
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

export const signOut = createRoute({
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

export const me = createRoute({
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

export const updateMe = createRoute({
  method: "patch",
  path: "/auth/admin/me",
  tags,
  summary: "Change your own name",
  description: "The email is the admin's sign-in and can't change here.",
  middleware: [requireAdmin] as const,
  security,
  request: body(UpdateAdminProfile),
  responses: {
    200: { description: "The admin, renamed", ...json(Admin) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: problemResponse(`ACCOUNT_SUSPENDED, or ${headerMissing}`),
  },
});

export const changePassword = createRoute({
  method: "post",
  path: "/auth/admin/me/password",
  tags,
  summary: "Change your own password",
  description:
    "Needs the current password. Signs every other browser out (this one stays signed in), and " +
    "a reset link another admin sent stops working.",
  middleware: [requireAdmin] as const,
  security,
  request: body(ChangeAdminPassword),
  responses: {
    204: { description: "Password changed" },
    400: problemResponse("WRONG_PASSWORD: the current password isn't right; or VALIDATION_FAILED"),
    401: unauthenticated,
    403: problemResponse(`ACCOUNT_SUSPENDED, or ${headerMissing}`),
    429: rateLimited,
  },
});

export const admins = createRoute({
  method: "get",
  path: "/admin/list",
  tags: ["Admins"],
  summary: "Every admin",
  description: "Oldest first. Suspended and banned admins are included.",
  middleware: [requireAdmin] as const,
  security,
  responses: {
    200: { description: "The admins", ...json(list(AdminListEntry)) },
    401: unauthenticated,
    403: problemResponse(headerMissing),
  },
});

export const admin = createRoute({
  method: "get",
  path: "/admin/list/{id}",
  tags: ["Admins"],
  summary: "One admin in full",
  description:
    "Who invited them, the invitations they've sent and the browsers they're signed in on.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: { description: "The admin", ...json(AdminDetails) },
    401: unauthenticated,
    403: problemResponse(headerMissing),
    404: problemResponse("ADMIN_NOT_FOUND"),
  },
});

export const resetAuthenticator = createRoute({
  method: "delete",
  path: "/admin/list/{id}/authenticator",
  tags: ["Admins"],
  summary: "Reset another admin's authenticator",
  description:
    "Forgets it and signs them out everywhere; their next sign-in sets up a new one. Not for your own account.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: "Reset" },
    401: unauthenticated,
    403: problemResponse(headerMissing),
    404: problemResponse("ADMIN_NOT_FOUND"),
    409: problemResponse("OWN_ADMIN_ACCOUNT"),
  },
});

export const requestPasswordReset = createRoute({
  method: "post",
  path: "/admin/list/{id}/password-reset",
  tags: ["Admins"],
  summary: "Email another admin a link to choose a new password",
  description:
    "The link works for 24 hours, replaces any earlier one, and signs them out everywhere once used. Nothing changes until then. Not for your own account.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: "Sent" },
    401: unauthenticated,
    403: problemResponse(headerMissing),
    404: problemResponse("ADMIN_NOT_FOUND"),
    409: problemResponse("OWN_ADMIN_ACCOUNT"),
    429: rateLimited,
    503: problemResponse("EMAIL_UNAVAILABLE: retry later."),
  },
});

export const invite = createRoute({
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

export const invitations = createRoute({
  method: "get",
  path: "/admin/invitations",
  tags: ["Admins"],
  summary: "Open admin invitations",
  middleware: [requireAdmin] as const,
  security,
  responses: {
    200: { description: "Not yet used, revoked or expired", ...json(list(AdminInvitation)) },
    401: unauthenticated,
    403: problemResponse(headerMissing),
  },
});

export const revokeInvitation = createRoute({
  method: "delete",
  path: "/admin/invitations/{id}",
  tags: ["Admins"],
  summary: "Revoke an invitation",
  description: "Its link stops working. Revoking one that's already revoked or expired is fine.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: "Revoked" },
    401: unauthenticated,
    403: problemResponse(headerMissing),
    404: problemResponse("INVITATION_NOT_FOUND"),
    409: problemResponse("INVITATION_ALREADY_ACCEPTED"),
  },
});

export const resetPassword = createRoute({
  method: "post",
  path: "/auth/admin/password-reset",
  tags,
  summary: "Choose a new password from a reset link",
  description:
    "The token is in the link's fragment (`#token=`). Signs the admin out everywhere; they then sign in with the new password.",
  request: body(ResetAdminPassword),
  responses: {
    204: { description: "Password changed" },
    400: problemResponse("PASSWORD_RESET_INVALID, or VALIDATION_FAILED"),
    429: rateLimited,
  },
});

export const accept = createRoute({
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
