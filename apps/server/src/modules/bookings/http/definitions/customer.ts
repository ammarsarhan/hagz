import { createRoute, z } from "@hono/zod-openapi";
import {
  Booking,
  BookingPage,
  PlayAgain,
  BookingQuote,
  BookingsQuery,
  BookingRequest,
  CreateBooking,
  IdempotencyHeaders,
  SharedBooking,
} from "@hagz/contracts";
import { CUSTOMER_BEARER, optionalCustomer, requireCustomer } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// A player's bookings (Phase 4).

const tags = ["Bookings"];
const security = [{ [CUSTOMER_BEARER]: [] }];
// Anyone, or a signed-in player.
const guestOrCustomer: Record<string, string[]>[] = [{ [CUSTOMER_BEARER]: [] }, {}];
const unavailable = problemResponse("The database is unavailable; retry.");
const notBookable = {
  404: problemResponse("GROUND_NOT_FOUND: no ground with that id at a live venue."),
  409: problemResponse(
    "SLOT_UNAVAILABLE: part of the time is taken or not open. VENUE_PAUSED or GROUND_UNAVAILABLE: not taking bookings for now. PAY_AT_VENUE_LIMIT or HOSTING_LIMIT (with `limit`): too many bookings paid at the venue, or games hosted, at once.",
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

export const playAgain = createRoute({
  method: "get",
  path: "/bookings/again",
  tags,
  summary: "Venues I've played at",
  description:
    "For Home's Play again: the live venues with a completed booking of mine, the latest first, each with the day, time and length played most there (once played twice). Names follow `Accept-Language`.",
  middleware: [requireCustomer] as const,
  security,
  responses: {
    200: { description: "The venues", ...json(PlayAgain) },
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

const moveResponses = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
  404: problemResponse("BOOKING_NOT_FOUND: none of yours with that id."),
  503: unavailable,
};
const bookingParams = z.object({ bookingId: z.uuid() });

export const acceptMove = createRoute({
  method: "post",
  path: "/bookings/{bookingId}/move/accept",
  tags,
  summary: "Keep a change the venue made",
  description:
    "Closes the choice on `move`; from then on the venue's cancellation policy applies as usual.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: bookingParams },
  responses: {
    200: { description: "The booking", ...json(Booking) },
    ...moveResponses,
    409: problemResponse("MOVE_NOT_OPEN: nothing left to answer (accepted, or the time is up)."),
  },
});

export const rejectMove = createRoute({
  method: "post",
  path: "/bookings/{bookingId}/move/reject",
  tags,
  summary: "Reject a change the venue made",
  description:
    "Cancels the booking as the venue's cancellation: everything paid is refunded in full.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: bookingParams },
  responses: {
    200: { description: "The cancelled booking", ...json(Booking) },
    ...moveResponses,
    409: problemResponse("MOVE_NOT_OPEN: nothing left to answer (accepted, or the time is up)."),
  },
});

export const moveBack = createRoute({
  method: "post",
  path: "/bookings/{bookingId}/move/back",
  tags,
  summary: "Move a booking back to where it was",
  description:
    "When `move.canMoveBack`: back to the original ground and time at the original price. Answers with the booking that replaces this one.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: bookingParams },
  responses: {
    200: { description: "The booking, back at its original time", ...json(Booking) },
    ...moveResponses,
    409: problemResponse(
      "MOVE_NOT_OPEN, or SLOT_UNAVAILABLE: the original time is taken (or it was a swap).",
    ),
  },
});

export const sharedBooking = createRoute({
  method: "get",
  path: "/shared-bookings/{code}",
  tags,
  summary: "A booking's share link",
  description:
    "What anyone with the link (/booking/{code}) sees: the venue, ground and time. No money and nothing about the customer. Signed in as the booker, `yours` is the booking's id. Names follow `Accept-Language`.",
  middleware: [optionalCustomer] as const,
  security: guestOrCustomer,
  request: { params: z.object({ code: z.string().min(1).max(16) }) },
  responses: {
    200: { description: "The booking", ...json(SharedBooking) },
    404: problemResponse("BOOKING_NOT_FOUND"),
    503: unavailable,
  },
});

const reservationResponses = {
  200: { description: "The booking", ...json(Booking) },
  ...moveResponses,
  409: problemResponse(
    "BOOKING_STATUS_CONFLICT: not a week waiting for an answer, or its deadline has passed.",
  ),
};

export const confirmReservation = createRoute({
  method: "post",
  path: "/bookings/{bookingId}/reservation/confirm",
  tags,
  summary: "Confirm my regular week",
  description: "Until its deadline. Paid at the venue.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: bookingParams },
  responses: reservationResponses,
});

export const releaseReservation = createRoute({
  method: "post",
  path: "/bookings/{bookingId}/reservation/release",
  tags,
  summary: "Release my regular week",
  description: "Until its deadline: I'm not playing that week. Nothing is owed.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: bookingParams },
  responses: reservationResponses,
});
