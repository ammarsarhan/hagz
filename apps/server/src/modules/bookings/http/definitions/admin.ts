import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminBooking,
  AdminBookingDetail,
  AdminBookingQuery,
  BookingHistoryEvent,
  BookingHistoryQuery,
  BookingStatus,
  page,
} from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

// Admin routes for the Bookings page: look up any booking and what happened to it.

const tags = ["Bookings (admin)"];
const security = [{ [ADMIN_COOKIE_AUTH]: [] }];
const guarded = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
  403: problemResponse(
    `ACCOUNT_SUSPENDED, or ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`,
  ),
};
const bookingId = z.object({ id: z.uuid() });

export const listBookings = createRoute({
  method: "get",
  path: "/admin/bookings",
  tags,
  summary: "Every booking, at every venue",
  description:
    "Newest made first, a page at a time. `counts` has how many match the search in each status, whatever `status` is, for the table's tabs.",
  middleware: [requireAdmin] as const,
  security,
  request: { query: AdminBookingQuery },
  responses: {
    200: {
      description: "A page of bookings",
      ...json(page(AdminBooking).extend({ counts: z.record(BookingStatus, z.int().min(0)) })),
    },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED: see `errors`."),
  },
});

export const getBooking = createRoute({
  method: "get",
  path: "/admin/bookings/{id}",
  tags,
  summary: "One booking in full",
  middleware: [requireAdmin] as const,
  security,
  request: { params: bookingId },
  responses: {
    200: { description: "The booking", ...json(AdminBookingDetail) },
    ...guarded,
    404: problemResponse("BOOKING_NOT_FOUND"),
  },
});

export const bookingHistory = createRoute({
  method: "get",
  path: "/admin/bookings/{id}/history",
  tags,
  summary: "Everything that happened to a booking",
  description: "Newest first, a page at a time.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: bookingId, query: BookingHistoryQuery },
  responses: {
    200: { description: "A page of events", ...json(page(BookingHistoryEvent)) },
    ...guarded,
    404: problemResponse("BOOKING_NOT_FOUND"),
  },
});
