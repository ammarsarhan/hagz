import { createMiddleware } from "hono/factory";
import { verifyJwt } from "@/platform/crypto/jwt";
import { AppError } from "@/platform/errors/app-error";

export interface CustomerActor {
  customerId: string;
  sessionId: string;
}

// The OpenAPI security scheme routes reference with `security: [{ [CUSTOMER_BEARER]: [] }]`.
export const CUSTOMER_BEARER = "customerBearer";

// Verifies the access token without a database lookup; that's why access tokens live only 10 minutes.
// A signed-out session's token keeps working until it expires.
export const requireCustomer = createMiddleware<{ Variables: { customer: CustomerActor } }>(
  async (c, next) => {
    const token = /^Bearer (.+)$/i.exec(c.req.header("Authorization") ?? "")?.[1];
    if (!token) {
      throw new AppError({
        code: "UNAUTHENTICATED",
        status: 401,
        detail: "Sign in to do this.",
        headers: { "WWW-Authenticate": "Bearer" },
      });
    }
    const claims = await verifyJwt(token, "customer");
    c.set("customer", { customerId: claims.sub, sessionId: claims.sid });
    await next();
  },
);
