import {
  bookingsAdminRoutes,
  bookingsCustomerRoutes,
  bookingsStaffRoutes,
} from "@/modules/bookings";
import {
  adminAuthRoutes,
  customerAuthRoutes,
  ensureAdminActive,
  staffAuthRoutes,
  supportAdminRoutes,
} from "@/modules/identity";
import { paymentsAdminRoutes, paymentsCustomerRoutes, paymentsDevRoutes } from "@/modules/payments";
import { locationsRoutes, platformAdminRoutes, whenAmenityUnplaceable } from "@/modules/locations";
import { systemRoutes } from "@/modules/system";
import {
  removeAmenityFromLayouts,
  venuesAdminRoutes,
  venuesFavoriteRoutes,
  venuesPublicRoutes,
  venuesStaffRoutes,
} from "@/modules/venues";
import { Scalar } from "@scalar/hono-api-reference";
import { appVersion } from "@/http/app-version";
import { devStorage, localDisk } from "@/http/dev-storage";
import { notFound, onError } from "@/http/errors";
import { health } from "@/http/health";
import { accessLog, bodyLimit, requestContext, requestId, timeout } from "@/http/middleware";
import { env } from "@/platform/config/env";
import { payments } from "@/platform/payments/payments";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_COOKIE_AUTH,
  bearerScheme,
  checkAdminsWith,
  CUSTOMER_BEARER,
  STAFF_BEARER,
} from "@/platform/http/authenticate";
import { createRouter } from "@/platform/http/router";

// Composition root: global middleware and every module's routes are mounted here. Order matters:
// the request id and its context first, so everything after (including errors) can log with it.
// (Separate statements, not a chain: .use() returns a plain Hono type without the OpenAPI methods.)
export const router = createRouter();

// Hooks that let a lower module reach what another owns, without importing it: admin requests check
// the admin is still active (identity owns their account), and an amenity made unplaceable leaves
// every layout (venues owns layouts, and reads locations).
checkAdminsWith(ensureAdminActive);
whenAmenityUnplaceable(removeAmenityFromLayouts);

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
router.route("/v1", venuesPublicRoutes);
router.route("/v1", venuesFavoriteRoutes);
router.route("/v1", bookingsCustomerRoutes);
router.route("/v1", paymentsCustomerRoutes);
router.route("/v1", venuesStaffRoutes);
router.route("/v1", bookingsStaffRoutes);
router.route("/v1", systemRoutes);
router.route("/v1", platformAdminRoutes);
router.route("/v1", venuesAdminRoutes);
router.route("/v1", bookingsAdminRoutes);
router.route("/v1", paymentsAdminRoutes);
router.route("/v1", supportAdminRoutes);

// Photos stored on disk in development are uploaded to and read from here (http/dev-storage.ts).
if (localDisk) router.route("/v1/dev/storage", devStorage(localDisk));

// Settling payments by hand, while the provider is the stand-in (platform/payments/payments.ts).
if (env.APP_ENV !== "production" && payments.name === "fake")
  router.route("/v1", paymentsDevRoutes);

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
