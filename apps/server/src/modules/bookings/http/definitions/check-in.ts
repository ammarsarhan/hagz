import { createRoute, z } from "@hono/zod-openapi";
import {
  CheckInCode,
  CheckInResult,
  ManualCheckIn,
  ScanCheckIn,
  StaffBookingDetail,
} from "@hagz/contracts";
import { requireVenueAccess } from "@/modules/venues";
import {
  CUSTOMER_BEARER,
  requireCustomer,
  requireStaff,
  STAFF_BEARER,
} from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// Checking in at the venue (2026-11-22): the player's QR code, and staff scanning it or ticking
// someone in by name, from 15 minutes before kick-off until 30 minutes after.

const tags = ["Check-in"];
const unauthenticated = problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED");
const code = { description: "The code to show as a QR code", ...json(CheckInCode) };
const staffSecurity = [{ [STAFF_BEARER]: [] }];
const venueBooking = z.object({ venueId: z.uuid(), bookingId: z.uuid() });
const closed = problemResponse(
  "NO_CHECK_IN: not a confirmed app booking, or CHECK_IN_CLOSED (with `opensAt`, `closesAt`).",
);

// Routes declare their middleware inline: spread from a shared object, the route types lose `c.var`.

export const bookerCode = createRoute({
  method: "get",
  path: "/bookings/{bookingId}/check-in-code",
  tags,
  summary: "My check-in code for a booking",
  description:
    "For a confirmed booking made in the app. Changes every 30 seconds (`refreshAt`); each code works for 60. Available until check-in closes, 30 minutes after kick-off.",
  middleware: [requireCustomer] as const,
  security: [{ [CUSTOMER_BEARER]: [] }],
  request: { params: z.object({ bookingId: z.uuid() }) },
  responses: {
    200: code,
    401: unauthenticated,
    404: problemResponse("BOOKING_NOT_FOUND"),
    409: closed,
  },
});

export const playerCode = createRoute({
  method: "get",
  path: "/games/{gameId}/check-in-code",
  tags,
  summary: "My check-in code for a game I joined",
  description: "Like the booker's code, for each joined player.",
  middleware: [requireCustomer] as const,
  security: [{ [CUSTOMER_BEARER]: [] }],
  request: { params: z.object({ gameId: z.uuid() }) },
  responses: {
    200: code,
    401: unauthenticated,
    409: problemResponse("NOT_JOINED, NO_CHECK_IN or CHECK_IN_CLOSED"),
  },
});

export const scanCheckIn = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/check-ins",
  tags,
  summary: "Check someone in with their QR code",
  description:
    "Needs `bookings: manage`. Scanning someone already checked in changes nothing (`already`).",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security: staffSecurity,
  request: { params: z.object({ venueId: z.uuid() }), ...body(ScanCheckIn) },
  responses: {
    200: { description: "Who was checked in", ...json(CheckInResult) },
    401: unauthenticated,
    403: problemResponse("PERMISSION_DENIED"),
    404: problemResponse("NOT_IN_BOOKING: they left the game or were removed."),
    409: problemResponse("CHECK_IN_OTHER_VENUE, NO_CHECK_IN or CHECK_IN_CLOSED"),
    422: problemResponse("CHECK_IN_CODE_INVALID or CHECK_IN_CODE_EXPIRED"),
  },
});

export const manualCheckIn = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/check-ins",
  tags,
  summary: "Check someone in by name",
  description:
    "Needs `bookings: manage`. For a booker or joined player without their code; marked as manual.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security: staffSecurity,
  request: { params: venueBooking, ...body(ManualCheckIn) },
  responses: {
    200: { description: "Who was checked in", ...json(CheckInResult) },
    401: unauthenticated,
    403: problemResponse("PERMISSION_DENIED"),
    404: problemResponse("BOOKING_NOT_FOUND or NOT_IN_BOOKING"),
    409: closed,
  },
});

export const undoCheckIn = createRoute({
  method: "delete",
  path: "/staff/venues/{venueId}/bookings/{bookingId}/check-ins/{customerId}",
  tags,
  summary: "Undo a check-in",
  description: "Needs `bookings: manage`. While check-in is open.",
  middleware: [requireStaff, requireVenueAccess("bookings", "manage")] as const,
  security: staffSecurity,
  request: { params: venueBooking.extend({ customerId: z.uuid() }) },
  responses: {
    200: { description: "The booking", ...json(StaffBookingDetail) },
    401: unauthenticated,
    403: problemResponse("PERMISSION_DENIED"),
    404: problemResponse("BOOKING_NOT_FOUND or NOT_IN_BOOKING"),
    409: closed,
  },
});
