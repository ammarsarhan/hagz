import { createRoute, z } from "@hono/zod-openapi";
import { BookingSettings, UpdateBookingSettings } from "@hagz/contracts";
import { requireVenueAccess } from "@/modules/venues";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// The venue's booking settings: staff holds, regulars and Fill a slot's thresholds. Stored with the
// venue's settings (the venues module writes them); served here because a change reaches the
// regulars' weeks already reserved (docs/regulars.md "Booking settings").

const security = [{ [STAFF_BEARER]: [] }];
const venueParams = z.object({ venueId: z.uuid() });
const common = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
  403: problemResponse("PERMISSION_DENIED (with `area` and `needed`), or ACCOUNT_SUSPENDED"),
};

const settingsTags = ["Venue settings"];

export const getBookingSettings = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/booking-settings",
  tags: settingsTags,
  summary: "Staff holds, regulars and Fill a slot settings",
  middleware: [requireStaff, requireVenueAccess("bookings", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "The settings", ...json(BookingSettings) },
    ...common,
    404: problemResponse("VENUE_NOT_FOUND"),
    409: problemResponse("VENUE_STATUS_CONFLICT: no settings yet."),
  },
});

export const updateBookingSettings = createRoute({
  method: "patch",
  path: "/staff/venues/{venueId}/booking-settings",
  tags: settingsTags,
  summary: "Change staff holds, regulars and Fill a slot settings",
  description:
    "Needs `venue: manage`. Only what's sent changes. A new hold length applies to holds made or extended from now on. A new confirmation window moves the deadline of every regular's week still waiting to it, unless that has already passed (the week keeps its deadline). A shorter horizon lets go of waiting weeks beyond it (confirmed ones stay); a longer one reserves the new weeks straight away.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: venueParams, ...body(UpdateBookingSettings) },
  responses: {
    200: { description: "The settings", ...json(BookingSettings) },
    ...common,
    404: problemResponse("VENUE_NOT_FOUND"),
    409: problemResponse("VENUE_STATUS_CONFLICT"),
  },
});
