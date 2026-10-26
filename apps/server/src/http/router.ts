import { Hono } from "hono";
import { notFound, onError } from "@/http/errors";
import { health } from "@/http/health";
import { accessLog, bodyLimit, requestContext, requestId, timeout } from "@/http/middleware";

// Composition root: global middleware and every module's routes are mounted here. Order matters:
// the request id and its context first, so everything after (including errors) can log with it.
export const router = new Hono()
  .use(requestId)
  .use(requestContext)
  .use(accessLog)
  .use(timeout)
  .use(bodyLimit)
  .route("/health", health);

router.notFound(notFound);
router.onError(onError);
