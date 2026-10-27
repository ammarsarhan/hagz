import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { env } from "@/platform/config/env";
import { verifyJwt, type Audience } from "@/platform/crypto/jwt";
import { AppError } from "@/platform/errors/app-error";

export interface CustomerActor {
  customerId: string;
  sessionId: string;
}

export interface StaffActor {
  staffId: string;
  sessionId: string;
}

// The OpenAPI security schemes routes reference with `security: [{ [CUSTOMER_BEARER]: [] }]`.
// Registered once on the root router (src/http/router.ts).
export const CUSTOMER_BEARER = "customerBearer";
export const STAFF_BEARER = "staffBearer";

export const bearerScheme = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "The access token from sign-up, sign-in or refresh.",
} as const;

// Verifies the access token without a database lookup; that's why access tokens live only 10 minutes.
// A signed-out session's token keeps working until it expires.
const bearerClaims = async (c: Context, audience: Audience) => {
  const token = /^Bearer (.+)$/i.exec(c.req.header("Authorization") ?? "")?.[1];
  if (!token) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      status: 401,
      detail: "Sign in to do this.",
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }
  return verifyJwt(token, audience);
};

export const requireCustomer = createMiddleware<{ Variables: { customer: CustomerActor } }>(
  async (c, next) => {
    const { sub, sid } = await bearerClaims(c, "customer");
    c.set("customer", { customerId: sub, sessionId: sid });
    await next();
  },
);

export const requireStaff = createMiddleware<{ Variables: { staff: StaffActor } }>(
  async (c, next) => {
    const { sub, sid } = await bearerClaims(c, "staff");
    c.set("staff", { staffId: sub, sessionId: sid });
    await next();
  },
);

// Admins use the web app, so their tokens live in httpOnly cookies where page scripts can't read
// them. The web app calls the API through its own origin, so the cookies are first-party: SameSite
// Strict, and `__Host-` (Secure, Path=/, no Domain) everywhere but local development over http.
export interface AdminActor {
  adminId: string;
  sessionId: string;
}

const secureCookies = env.APP_ENV !== "development";
const cookieName = (name: string) => (secureCookies ? `__Host-${name}` : name);
export const ADMIN_ACCESS_COOKIE = cookieName("hagz_admin_access");
export const ADMIN_REFRESH_COOKIE = cookieName("hagz_admin_refresh");
export const ADMIN_COOKIE_AUTH = "adminCookie";

// Cross-site requests can't set a custom header without a CORS preflight, which the API never
// approves, so requiring one stops CSRF even where SameSite isn't enforced.
export const ADMIN_CSRF_HEADER = "X-Hagz-Admin";

const cookieOptions = {
  httpOnly: true,
  secure: secureCookies,
  sameSite: "Strict",
  path: "/",
} as const;

export const setAdminSession = (
  c: Context,
  session: {
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string;
    refreshTokenExpiresIn: number;
  },
) => {
  setCookie(c, ADMIN_ACCESS_COOKIE, session.accessToken, {
    ...cookieOptions,
    maxAge: session.accessTokenExpiresIn,
  });
  setCookie(c, ADMIN_REFRESH_COOKIE, session.refreshToken, {
    ...cookieOptions,
    maxAge: session.refreshTokenExpiresIn,
  });
};

export const clearAdminSession = (c: Context) => {
  deleteCookie(c, ADMIN_ACCESS_COOKIE, cookieOptions);
  deleteCookie(c, ADMIN_REFRESH_COOKIE, cookieOptions);
};

export const adminRefreshToken = (c: Context) => getCookie(c, ADMIN_REFRESH_COOKIE);

// For every request that a cookie authenticates, including refresh and sign-out.
export const requireAdminHeader = createMiddleware(async (c, next) => {
  if (c.req.header(ADMIN_CSRF_HEADER) !== "1") {
    throw new AppError({
      code: "ADMIN_HEADER_REQUIRED",
      status: 403,
      detail: `Send the ${ADMIN_CSRF_HEADER}: 1 header with admin requests.`,
    });
  }
  await next();
});

export const requireAdmin = createMiddleware<{ Variables: { admin: AdminActor } }>(
  async (c, next) => {
    await requireAdminHeader(c, async () => {
      const token = getCookie(c, ADMIN_ACCESS_COOKIE);
      if (!token) {
        throw new AppError({ code: "UNAUTHENTICATED", status: 401, detail: "Sign in to do this." });
      }
      const { sub, sid } = await verifyJwt(token, "admin");
      c.set("admin", { adminId: sub, sessionId: sid });
      await next();
    });
  },
);
