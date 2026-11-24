import { createRouter } from "@/platform/http/router";
import { adminBookingPayments } from "../application/admin-payments";
import * as route from "./definitions/admin";

export const paymentsAdminRoutes = createRouter().openapi(route.bookingPayments, async (c) =>
  c.json(await adminBookingPayments(c.req.valid("param").id), 200),
);
