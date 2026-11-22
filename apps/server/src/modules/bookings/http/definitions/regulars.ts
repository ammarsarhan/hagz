import { createRoute, z } from "@hono/zod-openapi";
import {
  SlotCandidates,
  SlotCandidatesQuery,
  CreateRegular,
  OrderRegulars,
  StaffBookingDetail,
  UpdateRegular,
  VenueRegularDetail,
  VenueRegularList,
} from "@hagz/contracts";
import { requireVenueAccess } from "@/modules/venues";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// Regulars (PR 4.5, docs/regulars.md). Reading needs `bookings: view`; changing anything needs
// `bookings: manage`.

const tags = ["Regulars"];
const security = [{ [STAFF_BEARER]: [] }];
const venueParams = z.object({ venueId: z.uuid() });
const regularParams = venueParams.extend({ regularId: z.uuid() });
const bookingParams = venueParams.extend({ bookingId: z.uuid() });
const common = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
  403: problemResponse("PERMISSION_DENIED (with `area` and `needed`), or ACCOUNT_SUSPENDED"),
};
const notFound = problemResponse(
  "VENUE_NOT_FOUND: not a venue you belong to. REGULAR_NOT_FOUND: no such regular here.",
);
const detail = { description: "The regular", ...json(VenueRegularDetail) };
const ended = problemResponse("REGULAR_ENDED");

// Routes declare their middleware inline: spread from a shared object, the route types lose `c.var`.

export const listRegulars = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/regulars",
  tags,
  summary: "The venue's regulars",
  description: "By weekday and hour; overlapping ones in priority order. Ended ones included.",
  middleware: [requireStaff, requireVenueAccess("bookings", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "The regulars", ...json(VenueRegularList) },
    ...common,
    404: notFound,
  },
});

export const getRegular = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/regulars/{regularId}",
  tags,
  summary: "One regular, its coming reservations and skipped weeks",
  middleware: [requireStaff, requireVenueAccess("bookings", "view")] as const,
  security,
  request: { params: regularParams },
  responses: { 200: detail, ...common, 404: notFound },
});

export const createRegular = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/regulars",
  tags,
  summary: "Set up a regular",
  description:
    "Reserves every week up to the venue's `regularHorizon` straight away. Weeks whose time is taken or closed are skipped (listed in `skippedWeeks`) and tried again every day. A new regular goes last in priority.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: venueParams, ...body(CreateRegular) },
  responses: {
    201: detail,
    400: problemResponse("INVALID_PHONE_NUMBER"),
    ...common,
    404: problemResponse(
      "VENUE_NOT_FOUND, GROUND_NOT_FOUND, or CUSTOMER_NOT_FOUND: no such customer at this venue.",
    ),
    409: problemResponse("GROUND_UNAVAILABLE, or VENUE_STATUS_CONFLICT: the venue isn't live."),
    422: problemResponse(
      "INVALID_REGULAR_DATES, or INVALID_BOOKING_TIME (with `minimumSlots` and `maximumSlots`).",
    ),
  },
});

export const updateRegular = createRoute({
  method: "patch",
  path: "/staff/venues/{venueId}/regulars/{regularId}",
  tags,
  summary: "Change a regular's time, ground, length or end date",
  description:
    "A new time, ground or length releases its unconfirmed weeks and reserves the new time; an earlier end date releases the unconfirmed weeks after it. Confirmed weeks stay: move them if needed. These releases don't count against the regular.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: regularParams, ...body(UpdateRegular) },
  responses: {
    200: detail,
    ...common,
    404: problemResponse(`${notFound.description} GROUND_NOT_FOUND`),
    409: problemResponse("REGULAR_ENDED or GROUND_UNAVAILABLE"),
    422: problemResponse("INVALID_REGULAR_DATES or INVALID_BOOKING_TIME"),
  },
});

const stateRoute = (action: "pause" | "resume" | "end", summary: string, description: string) =>
  createRoute({
    method: "post",
    path: `/staff/venues/{venueId}/regulars/{regularId}/${action}`,
    tags,
    summary,
    description,
    middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
    security,
    request: { params: regularParams },
    responses: { 200: detail, ...common, 404: notFound, 409: ended },
  });

export const pauseRegular = stateRoute(
  "pause",
  "Pause a regular",
  "Releases its unconfirmed weeks at once (not counted against it); confirmed weeks stay. No new weeks are reserved until it resumes.",
);
export const resumeRegular = stateRoute(
  "resume",
  "Resume a paused regular",
  "Reserves its weeks again from the next free one.",
);
export const endRegular = stateRoute(
  "end",
  "End a regular",
  "Releases its unconfirmed weeks at once; confirmed weeks stay. It can't be resumed.",
);

export const orderRegulars = createRoute({
  method: "put",
  path: "/staff/venues/{venueId}/regulars/order",
  tags,
  summary: "Reorder overlapping regulars",
  description:
    "The regulars given take their places in this order, first priority first. Only weeks reserved from now on follow it: a week already reserved stays with its regular.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: venueParams, ...body(OrderRegulars) },
  responses: {
    200: { description: "The venue's regulars", ...json(VenueRegularList) },
    ...common,
    404: problemResponse(`${notFound.description} REGULARS_NOT_FOUND: some aren't at this venue.`),
  },
});

const reservationResponses = {
  200: { description: "The reservation after the change", ...json(StaffBookingDetail) },
  ...common,
  404: problemResponse(
    "VENUE_NOT_FOUND: not a venue you belong to. BOOKING_NOT_FOUND: no such booking at this venue.",
  ),
  409: problemResponse(
    "BOOKING_STATUS_CONFLICT: not an unconfirmed reservation, or its deadline has passed (with `bookingStatus`).",
  ),
};

export const confirmReservation = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/reservations/{bookingId}/confirm",
  tags,
  summary: "Confirm a regular's week",
  description: "Until its deadline. Paid at the venue.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams },
  responses: reservationResponses,
});

export const releaseReservation = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/reservations/{bookingId}/release",
  tags,
  summary: "Release a regular's week",
  description:
    "Until its deadline. The slots go back on sale, or to the next overlapping regular in priority.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams },
  responses: reservationResponses,
});

export const slotCandidates = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/slots/{slotId}/candidates",
  tags: ["Fill a slot"],
  summary: "Who to contact about an empty slot",
  description:
    "Needs `customers: view`. Lapsed regulars first, then active regulars (with another free slot near their usual time to offer), then everyone else; each group ranked by how well the slot fits them, fewer no-shows, then who played last.",
  middleware: [requireStaff, requireVenueAccess("customers", "view")] as const,
  security,
  request: { params: venueParams.extend({ slotId: z.uuid() }), query: SlotCandidatesQuery },
  responses: {
    200: { description: "The candidates", ...json(SlotCandidates) },
    ...common,
    404: problemResponse("VENUE_NOT_FOUND, or SLOT_NOT_FOUND: no such slot at this venue."),
  },
});
