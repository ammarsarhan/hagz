import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
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
