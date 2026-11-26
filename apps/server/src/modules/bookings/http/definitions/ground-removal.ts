import { createRoute, z } from "@hono/zod-openapi";
import { GroundRemoval } from "@hagz/contracts";
import { requireVenueAccess } from "@/modules/venues";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

// The warning before a ground is removed (user, 2026-11-27). Here, not with the grounds, because it
// reads bookings and regulars, and bookings may read venues but not the other way round.

export const groundRemoval = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/grounds/{groundId}/removal",
  tags: ["Grounds"],
  summary: "What removing a ground leaves behind",
  description:
    "Needs `schedule: view`. Its bookings and holds still ahead (they go ahead; the ground stays on the calendar, closed to new bookings, until the last one ends, then goes for good) and the regulars on it (they keep their reserved weeks, get no more, and end with the ground).",
  middleware: [requireStaff, requireVenueAccess("schedule", "view")] as const,
  security: [{ [STAFF_BEARER]: [] }],
  request: { params: z.object({ venueId: z.uuid(), groundId: z.uuid() }) },
  responses: {
    200: { description: "What it leaves behind", ...json(GroundRemoval) },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
    403: problemResponse("PERMISSION_DENIED (with `area` and `needed`), or ACCOUNT_SUSPENDED"),
    404: problemResponse("VENUE_NOT_FOUND or GROUND_NOT_FOUND"),
  },
});
