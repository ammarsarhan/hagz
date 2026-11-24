import { createRoute, z } from "@hono/zod-openapi";
import { AdminPayment, list } from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

export const bookingPayments = createRoute({
  method: "get",
  path: "/admin/bookings/{id}/payments",
  tags: ["Bookings (admin)"],
  summary: "A booking's payments and refunds",
  description: "Oldest first, every checkout including failed and replaced ones.",
  middleware: [requireAdmin] as const,
  security: [{ [ADMIN_COOKIE_AUTH]: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: { description: "The payments", ...json(list(AdminPayment)) },
    401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
    403: problemResponse(
      `ACCOUNT_SUSPENDED, or ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`,
    ),
    404: problemResponse("BOOKING_NOT_FOUND"),
  },
});
