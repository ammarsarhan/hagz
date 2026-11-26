import { createRoute, z } from "@hono/zod-openapi";
import { SchedulePreview, WeekSchedule } from "@hagz/contracts";
import { requireVenueAccess } from "@/modules/venues";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// The warning before a ground's hours change (user, 2026-11-27). Here, not with the grounds, because
// it reads bookings and regulars, and bookings may read venues but not the other way round.

export const schedulePreview = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/grounds/{groundId}/schedule/preview",
  tags: ["Grounds"],
  summary: "What a new week of hours would leave behind",
  description:
    "Needs `schedule: manage`. Saves nothing. Counts what falls in hours the week would close: bookings and holds still ahead (they go ahead), requests waiting (declined on save), and regulars whose weekly time it closes, wholly or in part (they keep the weeks already reserved and end after the last).",
  middleware: [requireStaff, requireVenueAccess("schedule", "manage")] as const,
  security: [{ [STAFF_BEARER]: [] }],
  request: {
    params: z.object({ venueId: z.uuid(), groundId: z.uuid() }),
    ...body(WeekSchedule),
  },
  responses: {
    200: { description: "What it would leave behind", ...json(SchedulePreview) },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
    403: problemResponse("PERMISSION_DENIED (with `area` and `needed`), or ACCOUNT_SUSPENDED"),
    404: problemResponse("VENUE_NOT_FOUND or GROUND_NOT_FOUND"),
  },
});
