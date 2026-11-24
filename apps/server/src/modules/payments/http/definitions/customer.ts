import { createRoute, z } from "@hono/zod-openapi";
import { Booking, Checkout, IdempotencyHeaders, StartCheckout } from "@hagz/contracts";
import { CUSTOMER_BEARER, requireCustomer } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// Paying for a booking online. Until Phase 5 the provider is a stand-in that takes no money.

const tags = ["Payments"];
const security = [{ [CUSTOMER_BEARER]: [] }];
const unauthenticated = problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED");
const unavailable = problemResponse("The database is unavailable; retry.");

export const startCheckout = createRoute({
  method: "post",
  path: "/bookings/{bookingId}/payments",
  tags,
  summary: "Start paying for a held booking",
  description:
    "For a `HELD` booking before its `expiresAt`: the deposit, or the whole total. A newer checkout replaces one still waiting. Retrying with the same `Idempotency-Key` returns the same payment.",
  middleware: [requireCustomer] as const,
  security,
  request: {
    params: z.object({ bookingId: z.uuid() }),
    headers: IdempotencyHeaders,
    ...body(StartCheckout),
  },
  responses: {
    201: { description: "Checkout started", ...json(Checkout) },
    401: unauthenticated,
    404: problemResponse("BOOKING_NOT_FOUND"),
    409: problemResponse(
      "HOLD_EXPIRED: the time to pay ran out. BOOKING_NOT_AWAITING_PAYMENT (with `bookingStatus`): nothing to pay online now, e.g. still waiting for approval.",
    ),
    422: problemResponse("IDEMPOTENCY_KEY_REUSED"),
    503: problemResponse(
      "PAYMENTS_UNAVAILABLE: no payment provider yet (production), or the database is unavailable.",
    ),
  },
});

const settle = (outcome: "succeed" | "fail", summary: string) =>
  createRoute({
    method: "post",
    path: `/dev/payments/{paymentId}/${outcome}`,
    tags: ["Development"],
    summary,
    description:
      "Development and staging only, while the provider is the stand-in: settles one of your own pending payments as the provider would.",
    middleware: [requireCustomer] as const,
    security,
    request: { params: z.object({ paymentId: z.uuid() }) },
    responses: {
      200: { description: "The booking after the outcome", ...json(Booking) },
      401: unauthenticated,
      404: problemResponse("PAYMENT_NOT_FOUND"),
      409: problemResponse("PAYMENT_SETTLED: it already has its outcome."),
      503: unavailable,
    },
  });

export const succeedPayment = settle("succeed", "Mark a stand-in payment paid");
export const failPayment = settle("fail", "Mark a stand-in payment failed");
