import { STATUS_CODES } from "node:http";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { currentContext } from "@/platform/context/request-context";
import { isDatabaseUnavailable } from "@/platform/db/errors";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";

// RFC 9457 problem details. `type` stays about:blank (so `title` is the status phrase) until we
// publish a page per problem; clients switch on `code`.
interface Problem {
  type: "about:blank";
  title: string;
  status: ContentfulStatusCode;
  code: string;
  detail: string;
  // Quoted by users to support, and the key to this request's logs.
  requestId: string | undefined;
  [extension: string]: unknown;
}

// Codes for errors Hono's own middleware throws as HTTPException (e.g. malformed JSON, body limit).
const codeForStatus: Partial<Record<number, string>> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  413: "PAYLOAD_TOO_LARGE",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

// Built through the context (not new Response) so headers set by middleware, such as X-Request-Id,
// are kept on error responses too.
const problem = (
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  detail: string,
  extensions: Record<string, unknown> = {},
): Response =>
  // Extensions first, so they can never overwrite the standard members.
  c.json(
    {
      ...extensions,
      type: "about:blank",
      title: STATUS_CODES[status] ?? "Error",
      status,
      code,
      detail,
      requestId: currentContext()?.requestId,
    } satisfies Problem,
    status,
    { "Content-Type": "application/problem+json" },
  );

const genericDetail = "Something went wrong on our side. Please try again.";

export const onError: ErrorHandler = (error, c) => {
  if (error instanceof AppError) {
    if (error.status >= 500) logger.error({ err: error }, "request failed");
    for (const [name, value] of Object.entries(error.headers)) c.header(name, value);
    return problem(c, error.status, error.code, error.message, error.extensions);
  }

  if (error instanceof HTTPException) {
    if (error.status >= 500) {
      // Keep the status (a timeout's 503 tells clients to retry) but not the message.
      logger.error({ err: error }, "request failed");
      return problem(
        c,
        error.status,
        codeForStatus[error.status] ?? "INTERNAL_ERROR",
        genericDetail,
      );
    }
    const code = codeForStatus[error.status] ?? "BAD_REQUEST";
    return problem(c, error.status, code, error.message || (STATUS_CODES[error.status] ?? "Error"));
  }

  // Overloaded or unreachable database: worth retrying, so not a 500.
  if (isDatabaseUnavailable(error)) {
    logger.warn({ err: error }, "database unavailable");
    return problem(c, 503, "SERVICE_UNAVAILABLE", genericDetail);
  }

  // A bug. Log everything, tell the client nothing about it.
  logger.error({ err: error }, "unhandled error");
  return problem(c, 500, "INTERNAL_ERROR", genericDetail);
};

export const notFound: NotFoundHandler = (c) =>
  problem(c, 404, "NOT_FOUND", `No route for ${c.req.method} ${c.req.path}.`);
