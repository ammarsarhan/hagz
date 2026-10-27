import { adminAuthRoutes, customerAuthRoutes, staffAuthRoutes } from "@/modules/identity";
import { locationsRoutes } from "@/modules/locations";
import { venuesStaffRoutes } from "@/modules/venues";
import { Scalar } from "@scalar/hono-api-reference";
import { appVersion } from "@/http/app-version";
import { notFound, onError } from "@/http/errors";
import { health } from "@/http/health";
import { accessLog, bodyLimit, requestContext, requestId, timeout } from "@/http/middleware";
import { env } from "@/platform/config/env";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_COOKIE_AUTH,
  bearerScheme,
  CUSTOMER_BEARER,
  STAFF_BEARER,
} from "@/platform/http/authenticate";
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
router.use("/v1/*", appVersion);

router.route("/health", health);
router.route("/v1", locationsRoutes);
router.route("/v1", customerAuthRoutes);
router.route("/v1", staffAuthRoutes);
router.route("/v1", adminAuthRoutes);
router.route("/v1", venuesStaffRoutes);

// The contract the apps are built against, and a browsable page for it. Not served in production:
// they list every route, including admin ones. The committed copy is apps/server/openapi.json.
router.openAPIRegistry.registerComponent("securitySchemes", CUSTOMER_BEARER, bearerScheme);
router.openAPIRegistry.registerComponent("securitySchemes", STAFF_BEARER, bearerScheme);
router.openAPIRegistry.registerComponent("securitySchemes", ADMIN_COOKIE_AUTH, {
  type: "apiKey",
  in: "cookie",
  name: ADMIN_ACCESS_COOKIE,
  description: "Set by signing in. Named with a `__Host-` prefix outside local development.",
});

if (env.APP_ENV !== "production") {
  router.doc31("/v1/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Hagz API", version: "1" },
  });
  router.get(
    "/v1/docs",
    Scalar({
      url: "/v1/openapi.json",
      pageTitle: "Hagz API",
      // Pinned: the default loads whatever version jsDelivr serves as latest, unreviewed. Setting
      // `cdn` makes the page load a classic <script src>, so this must be the standalone build
      // (esm.js is an ES module and leaves the page blank).
      cdn: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.74.0/dist/browser/standalone.js",
    }),
  );
}

router.notFound(notFound);
router.onError(onError);
