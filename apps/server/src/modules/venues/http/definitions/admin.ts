import { createRoute, z } from "@hono/zod-openapi";
import { AdminVenue, AdminVenueQuery, page, VenueStatus } from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

// Admin routes for the Venues page.

const tags = ["Venues (admin)"];
const security = [{ [ADMIN_COOKIE_AUTH]: [] }];
const guarded = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
  403: problemResponse(`ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`),
};

export const listVenues = createRoute({
  method: "get",
  path: "/admin/venues",
  tags,
  summary: "Every venue, in any status",
  description:
    "Newest first, a page at a time. `counts` has how many match the search in each status, " +
    "whatever `status` is, for the table's tabs.",
  middleware: [requireAdmin] as const,
  security,
  request: { query: AdminVenueQuery },
  responses: {
    200: {
      description: "A page of venues",
      ...json(page(AdminVenue).extend({ counts: z.record(VenueStatus, z.int().min(0)) })),
    },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED: see `errors`."),
  },
});
