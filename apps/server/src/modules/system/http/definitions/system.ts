import { createRoute, z } from "@hono/zod-openapi";
import { JobsStatus, QueueName, SystemHistory, SystemStatus } from "@hagz/contracts";
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

export const jobs = createRoute({
  method: "get",
  path: "/admin/jobs",
  tags: ["System"],
  summary: "The background queues",
  description:
    "Each queue's waiting, active, delayed and failed jobs and the one waiting longest; when slot " +
    "generation's nightly roll-forward, drift audit and checks last finished; and the jobs that " +
    "failed on their last attempt, newest first.",
  middleware: [requireAdmin] as const,
  security: [{ [ADMIN_COOKIE_AUTH]: [] }],
  responses: {
    200: { description: "The queues now", content: { "application/json": { schema: JobsStatus } } },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
    403: problemResponse(`ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`),
  },
});

export const retryJob = createRoute({
  method: "post",
  path: "/admin/jobs/{queue}/{jobId}/retry",
  tags: ["System"],
  summary: "Retry a failed job",
  description: "Runs a job that failed on its last attempt again, from its first attempt.",
  middleware: [requireAdmin] as const,
  security: [{ [ADMIN_COOKIE_AUTH]: [] }],
  request: { params: z.object({ queue: QueueName, jobId: z.string().min(1).max(200) }) },
  responses: {
    204: { description: "Queued again" },
    400: problemResponse("VALIDATION_FAILED: not one of the queues"),
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
    403: problemResponse(`ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`),
    404: problemResponse("JOB_NOT_FOUND: no failed job with that id there"),
  },
});
