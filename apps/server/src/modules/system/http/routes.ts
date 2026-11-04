import { createRoute } from "@hono/zod-openapi";
import { SystemStatus } from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { createRouter, problemResponse } from "@/platform/http/router";
import { systemStatus } from "../application/status";

const statusRoute = createRoute({
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

export const systemRoutes = createRouter().openapi(statusRoute, async (c) => {
  return c.json(await systemStatus(), 200);
});
