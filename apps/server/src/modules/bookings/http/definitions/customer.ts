import { createRoute, z } from "@hono/zod-openapi";
import {
  Booking,
  BookingPage,
  BookingQuote,
  BookingsQuery,
  BookingRequest,
  CreateBooking,
  IdempotencyHeaders,
} from "@hagz/contracts";
import { CUSTOMER_BEARER, requireCustomer } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// A player's bookings (Phase 4).

const tags = ["Bookings"];
const security = [{ [CUSTOMER_BEARER]: [] }];
const unavailable = problemResponse("The database is unavailable; retry.");
const notBookable = {
  404: problemResponse("GROUND_NOT_FOUND: no ground with that id at a live venue."),
  409: problemResponse(
    "SLOT_UNAVAILABLE: part of the time is taken or not open. VENUE_PAUSED or GROUND_UNAVAILABLE: not taking bookings for now.",
  ),
  422: problemResponse(
    "INVALID_BOOKING_TIME (with the limit it broke: `minimumNotice`, `horizonDays`, or `minimumSlots` and `maximumSlots`), or AMENITY_NOT_AVAILABLE.",
  ),
};

export const quoteBooking = createRoute({
  method: "post",
  path: "/bookings/quote",
  tags,
  summary: "Price a booking before making it",
  description:
    "For the review step: the charges, VAT, deposit and what the booking would start as. Open to guests. Nothing is held, so the time can still be taken before booking. Names follow `Accept-Language`.",
  request: body(BookingRequest),
  responses: {
    200: { description: "The price", ...json(BookingQuote) },
    ...notBookable,
    503: unavailable,
  },
});

export const createBooking = createRoute({
  method: "post",
  path: "/bookings",
  tags,
  summary: "Book a ground",
  description:
    "Books back-to-back slots on one ground. Starts `CONFIRMED`, `PENDING` (the venue approves, until `expiresAt`) or `HELD` (waiting for payment, until `expiresAt`). Retrying with the same `Idempotency-Key` returns the same booking with `Idempotent-Replayed: true`.",
  middleware: [requireCustomer] as const,
  security,
  request: { headers: IdempotencyHeaders, ...body(CreateBooking) },
  responses: {
    201: {
      description: "Booked",
      headers: z.object({
        "Idempotent-Replayed": z.literal("true").optional().meta({
          description: "Set when this answers a retry with the booking already made.",
        }),
      }),
      ...json(Booking),
    },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
    403: problemResponse("ACCOUNT_SUSPENDED"),
    ...notBookable,
    422: problemResponse(
      `${notBookable[422].description} IDEMPOTENCY_KEY_REUSED: the key was used for a different booking.`,
    ),
    503: unavailable,
  },
});

export const listBookings = createRoute({
  method: "get",
  path: "/bookings",
  tags,
  summary: "List my bookings",
  description:
    "Upcoming (still to be played, soonest first) or past (played, cancelled, expired or released, latest first). A booking the venue moved isn't listed; the one that replaced it is. Names follow `Accept-Language`.",
  middleware: [requireCustomer] as const,
  security,
  request: { query: BookingsQuery },
  responses: {
    200: { description: "A page of bookings", ...json(BookingPage) },
    400: problemResponse("INVALID_CURSOR"),
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
    503: unavailable,
  },
});

export const getBooking = createRoute({
  method: "get",
  path: "/bookings/{bookingId}",
  tags,
  summary: "Get one of my bookings",
  description: "Names follow `Accept-Language`.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: z.object({ bookingId: z.uuid() }) },
  responses: {
    200: { description: "The booking", ...json(Booking) },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
    404: problemResponse("BOOKING_NOT_FOUND: none of yours with that id."),
    503: unavailable,
  },
});
