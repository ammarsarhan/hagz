import { createRouter } from "@/platform/http/router";
import {
  adminBookingDetail,
  bookingHistory,
  listAdminBookings,
} from "../application/admin-bookings";
import * as route from "./definitions/admin";

export const bookingsAdminRoutes = createRouter()
  .openapi(route.listBookings, async (c) =>
    c.json(await listAdminBookings(c.req.valid("query")), 200),
  )
  .openapi(route.getBooking, async (c) =>
    c.json(await adminBookingDetail(c.req.valid("param").id), 200),
  )
  .openapi(route.bookingHistory, async (c) =>
    c.json(await bookingHistory(c.req.valid("param").id, c.req.valid("query")), 200),
  );
