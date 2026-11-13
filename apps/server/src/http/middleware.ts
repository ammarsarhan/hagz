import { bodyLimit as honoBodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { requestId as honoRequestId } from "hono/request-id";
import { routePath } from "hono/route";
import { timeout as honoTimeout } from "hono/timeout";
import { runWithContext } from "@/platform/context/request-context";
import { logger } from "@/platform/logger/logger";

// Takes the client's X-Request-Id when it is a short, safe token (so the apps can correlate their
// own logs), otherwise generates one. Echoed back on every response.
export const requestId = honoRequestId();

// Everything after this runs inside the request's context, including the error handler.
export const requestContext = createMiddleware<{ Variables: { requestId: string } }>((c, next) =>
  runWithContext({ requestId: c.var.requestId }, next),
);

// One line per request. The route pattern, not the path, so ids and booking codes stay out of logs.
// Health probes are skipped: they run every few seconds and say nothing about traffic.
export const accessLog = createMiddleware(async (c, next) => {
  if (c.req.path.startsWith("/health/")) return next();
  const start = performance.now();
  await next();
  const status = c.res.status;
  logger[status >= 500 ? "error" : "info"](
    {
      method: c.req.method,
      route: routePath(c, -1),
      status,
      durationMs: Math.round(performance.now() - start),
    },
    "request",
  );
});

// The client gets a 503 after this long, but the handler is not cancelled: it runs to completion
// in the background. Database statement timeouts are what actually stop work; idempotency keys make
// the client's retry safe.
export const timeout = honoTimeout(
  15_000,
  new HTTPException(503, { message: "Request timed out." }),
);

// JSON only. Files go straight to object storage through presigned URLs, never through the API.
const jsonBodyLimit = honoBodyLimit({
  maxSize: 100 * 1024,
  onError: () => {
    throw new HTTPException(413, { message: "Request body is larger than 100 KB." });
  },
});

// Every body is JSON and small, except photo uploads to the development file store
// (http/dev-storage.ts), which sets its own limit. In other environments uploads go straight to the
// bucket and never reach the API.
export const DEV_STORAGE_PATH = "/v1/dev/storage/";

export const bodyLimit = createMiddleware(async (c, next) => {
  if (c.req.path.startsWith(DEV_STORAGE_PATH)) return next();
  return jsonBodyLimit(c, next);
});
