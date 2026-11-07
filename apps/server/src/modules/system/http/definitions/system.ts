import { createRoute } from "@hono/zod-openapi";
import { SystemHistory, SystemStatus } from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { problemResponse } from "@/platform/http/definitions";

export const status = createRoute({
  method: "get",
  path: "/admin/status",
  tags: ["System"],
  summary: "Whether each part of the platform is running",
  description:
    "The server and worker (commit, start time, last seen; the worker from its heartbeat), and the " +
    "round trip to Postgres and both Redis instances. Every check is capped, so a dead dependency " +
    "shows as `DOWN` instead of holding the request.",
  middleware: [requireAdmin] as const,
  security: [{ [ADMIN_COOKIE_AUTH]: [] }],
  responses: {
    200: {
      description: "The status right now",
      content: { "application/json": { schema: SystemStatus } },
    },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
    403: problemResponse(`ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`),
  },
});

export const history = createRoute({
  method: "get",
  path: "/admin/status/history",
  tags: ["System"],
  summary: "The last 24 hours, minute by minute",
  description:
    "One sample a minute, taken by the server: the three response times and whether the worker's " +
    "heartbeat was there. A missing minute means no server was running. Oldest first.",
  middleware: [requireAdmin] as const,
  security: [{ [ADMIN_COOKIE_AUTH]: [] }],
  responses: {
    200: { description: "The samples", content: { "application/json": { schema: SystemHistory } } },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
    403: problemResponse(`ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`),
    503: problemResponse("SERVICE_UNAVAILABLE: the queue Redis, where the history lives, is down."),
  },
});
