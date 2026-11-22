import { createRoute, z } from "@hono/zod-openapi";
import {
  BookingHistoryEvent,
  BookingHistoryQuery,
  CreateHold,
  DeclineBooking,
  MarkBooking,
  MoveBooking,
  page,
  StaffBookingDetail,
  StaffBookingList,
  StaffBookingsQuery,
  SwapBookings,
  SwappedBookings,
} from "@hagz/contracts";
import { requireVenueAccess } from "@/modules/venues";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// A venue's bookings for its staff: the calendar and approvals (PR 4.4), deciding and marking
// (PR 4.2), and holds, moves and swaps (PR 4.8). Reading needs `bookings: view`; changing anything
// needs `bookings: manage`.

const tags = ["Venue bookings"];
const security = [{ [STAFF_BEARER]: [] }];
const venueParams = z.object({ venueId: z.uuid() });
const bookingParams = venueParams.extend({ bookingId: z.uuid() });
const common = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
  403: problemResponse("PERMISSION_DENIED (with `area` and `needed`), or ACCOUNT_SUSPENDED"),
};
const notFound = problemResponse(
  "VENUE_NOT_FOUND: not a venue you belong to. BOOKING_NOT_FOUND: no such booking at this venue.",
);
const moved = problemResponse(
  "BOOKING_STATUS_CONFLICT: it has already moved on (with `bookingStatus`).",
);
const detail = { description: "The booking after the change", ...json(StaffBookingDetail) };
const badTime = problemResponse(
  "INVALID_BOOKING_TIME (with the limit it broke: `horizonDays`, or `minimumSlots` and `maximumSlots`)",
);

// Routes declare their middleware inline: spread from a shared object, the route types lose `c.var`.

export const listBookings = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/bookings",
  tags,
  summary: "The calendar: bookings by day and ground",
  description:
    "Bookings overlapping the venue-local days from `date`, up to a week, by start time then ground. Without a `status`, the ones holding their slots.",
  middleware: [requireStaff, requireVenueAccess("bookings", "view")] as const,
  security,
  request: { params: venueParams, query: StaffBookingsQuery },
  responses: {
    200: { description: "The bookings", ...json(StaffBookingList) },
    ...common,
    404: notFound,
  },
});

export const pendingBookings = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/bookings/pending",
  tags,
  summary: "Bookings waiting for approval",
  description: "Not yet expired, the ones that expire soonest first.",
  middleware: [requireStaff, requireVenueAccess("bookings", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "The bookings", ...json(StaffBookingList) },
    ...common,
    404: notFound,
  },
});

export const getBooking = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/bookings/{bookingId}",
  tags,
  summary: "One booking in full",
  description:
    "With its customer, charges, payments so far, cancellation, and where it was moved from and to.",
  middleware: [requireStaff, requireVenueAccess("bookings", "view")] as const,
  security,
  request: { params: bookingParams },
  responses: {
    200: { description: "The booking", ...json(StaffBookingDetail) },
    ...common,
    404: notFound,
  },
});

export const bookingHistory = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/history",
  tags,
  summary: "What happened to a booking",
  description: "Its events, newest first, a page at a time.",
  middleware: [requireStaff, requireVenueAccess("bookings", "view")] as const,
  security,
  request: { params: bookingParams, query: BookingHistoryQuery },
  responses: {
    200: { description: "A page of events", ...json(page(BookingHistoryEvent)) },
    ...common,
    404: notFound,
  },
});

export const approveBooking = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/approve",
  tags,
  summary: "Approve a booking",
  description:
    "A `PENDING` booking before it expires. With something to pay online it becomes `HELD` for the venue's payment window (never past kick-off); otherwise `CONFIRMED`.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams },
  responses: { 200: detail, ...common, 404: notFound, 409: moved },
});

export const declineBooking = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/decline",
  tags,
  summary: "Decline a booking",
  description:
    "A `PENDING` booking before it expires. It's cancelled as the venue's decision (a full refund of anything paid) and its slots are free again.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams, ...body(DeclineBooking) },
  responses: { 200: detail, ...common, 404: notFound, 409: moved },
});

export const markBooking = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/mark",
  tags,
  summary: "Mark a game played or a no-show",
  description:
    "A `CONFIRMED` booking once it has kicked off, or a correction of the mark. Marking it as it already is changes nothing.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams, ...body(MarkBooking) },
  responses: {
    200: detail,
    ...common,
    404: notFound,
    409: problemResponse(
      "BOOKING_STATUS_CONFLICT (with `bookingStatus`), or BOOKING_NOT_STARTED: it hasn't kicked off yet.",
    ),
  },
});

export const moveBooking = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/move",
  tags,
  summary: "Move a booking to another time or ground",
  description:
    "For bookings still to be played, before they start. The booking ends `RESCHEDULED` and a new one takes its customer, status and terms at the new slots' prices; answers with the new booking. The target must be free, the booking's own, or held by `holdId` (which ends with the move). The player can reject the move for a full refund, for 24 hours or until kick-off.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams, ...body(MoveBooking) },
  responses: {
    200: { description: "The new booking", ...json(StaffBookingDetail) },
    ...common,
    404: problemResponse(`${notFound.description} GROUND_NOT_FOUND: no such ground here.`),
    409: problemResponse(
      "BOOKING_NOT_MOVABLE, SLOT_UNAVAILABLE, HOLD_NOT_FOUND: the hold has ended, or GROUND_UNAVAILABLE.",
    ),
    422: badTime,
  },
});

export const swapBookings = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/swap",
  tags,
  summary: "Swap two bookings' times",
  description:
    "Each takes the other's ground and time, keeping its own customer and terms at its new slots' prices. Both customers can reject their side.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams, ...body(SwapBookings) },
  responses: {
    200: { description: "The two new bookings", ...json(SwappedBookings) },
    ...common,
    404: notFound,
    409: problemResponse("BOOKING_NOT_MOVABLE, SLOT_UNAVAILABLE or GROUND_UNAVAILABLE"),
    422: problemResponse(`INVALID_SWAP: the same booking twice. ${badTime.description}`),
  },
});

export const createHold = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/holds",
  tags,
  summary: "Hold slots for someone",
  description:
    "Keeps free slots as a `HELD` booking for the venue's `staffHoldMinutes`, for someone deciding on the phone or a move being confirmed. Staff can hold right up to kick-off. Nothing to pay through Hagz and no commission.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: venueParams, ...body(CreateHold) },
  responses: {
    201: { description: "The hold", ...json(StaffBookingDetail) },
    400: problemResponse("INVALID_PHONE_NUMBER"),
    ...common,
    404: problemResponse(
      `${notFound.description} GROUND_NOT_FOUND, or CUSTOMER_NOT_FOUND: no such customer at this venue.`,
    ),
    409: problemResponse(
      "SLOT_UNAVAILABLE, GROUND_UNAVAILABLE, or VENUE_STATUS_CONFLICT: the venue isn't live.",
    ),
    422: badTime,
  },
});

const holdResponses = {
  200: detail,
  ...common,
  404: problemResponse("HOLD_NOT_FOUND: no such hold at this venue."),
  409: problemResponse(
    "BOOKING_STATUS_CONFLICT: confirmed, released or run out already (with `bookingStatus`).",
  ),
};

export const confirmHold = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/holds/{bookingId}/confirm",
  tags,
  summary: "Confirm a hold as a booking",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams },
  responses: holdResponses,
});

export const extendHold = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/holds/{bookingId}/extend",
  tags,
  summary: "Give a hold more time, once",
  description: "Adds the venue's `staffHoldMinutes` to its deadline.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams },
  responses: {
    ...holdResponses,
    409: problemResponse(
      `${holdResponses[409].description} HOLD_ALREADY_EXTENDED: it has had its extension.`,
    ),
  },
});

export const releaseHold = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/holds/{bookingId}/release",
  tags,
  summary: "Let a hold go",
  description: "Frees its slots at once. It ends `EXPIRED`, as if it had run out.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security,
  request: { params: bookingParams },
  responses: holdResponses,
});
