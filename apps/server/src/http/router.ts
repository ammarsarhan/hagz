import { locationsRoutes } from "@/modules/locations";
import { notFound, onError } from "@/http/errors";
import { health } from "@/http/health";
import { accessLog, bodyLimit, requestContext, requestId, timeout } from "@/http/middleware";
import { env } from "@/platform/config/env";
import { createRouter } from "@/platform/http/router";

// Composition root: global middleware and every module's routes are mounted here. Order matters:
// the request id and its context first, so everything after (including errors) can log with it.
// (Separate statements, not a chain: .use() returns a plain Hono type without the OpenAPI methods.)
export const router = createRouter();

router.use(requestId);
router.use(requestContext);
router.use(accessLog);
router.use(timeout);
router.use(bodyLimit);

router.route("/health", health);
router.route("/v1", locationsRoutes);

// The contract the apps are built against. Not served in production: it lists every route,
// including admin ones. CI keeps a copy to diff against the base branch.
if (env.APP_ENV !== "production") {
  router.doc31("/v1/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Hagz API", version: "1" },
  });
}

router.notFound(notFound);
router.onError(onError);
