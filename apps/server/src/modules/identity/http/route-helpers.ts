import type { Context } from "hono";
import { problemResponse } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";

// Pieces the customer and staff auth routes share.
export const json = <T>(schema: T) => ({ content: { "application/json": { schema } } });
export const body = <T>(schema: T) => ({ body: { required: true, ...json(schema) } });
export const device = (c: Context) => ({
  ip: clientIp(c),
  userAgent: c.req.header("User-Agent"),
});

export const unauthenticated = problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED");
export const unavailable = problemResponse(
  "SERVICE_UNAVAILABLE or MESSAGING_UNAVAILABLE: retry later.",
);
export const codeRejected = problemResponse("INVALID_CODE (with `attemptsLeft`) or CODE_EXPIRED");
