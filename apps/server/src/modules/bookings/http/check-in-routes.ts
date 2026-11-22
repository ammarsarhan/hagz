import { createRouter } from "@/platform/http/router";
import {
  bookerCode,
  manualCheckIn,
  playerCode,
  scanCheckIn,
  undoCheckIn,
} from "../application/check-in";
import { staffBookingDetail } from "../application/staff-bookings";
import * as route from "./definitions/check-in";

export const bookingsCheckInRoutes = createRouter()
  .openapi(route.bookerCode, async (c) =>
    c.json(await bookerCode(c.get("customer").customerId, c.req.valid("param").bookingId), 200),
  )
  .openapi(route.playerCode, async (c) =>
    c.json(await playerCode(c.get("customer").customerId, c.req.valid("param").gameId), 200),
  )
  .openapi(route.scanCheckIn, async (c) =>
    c.json(await scanCheckIn(c.var.venue, c.req.valid("json").code), 200),
  )
  .openapi(route.manualCheckIn, async (c) => {
    const { bookingId } = c.req.valid("param");
    return c.json(await manualCheckIn(c.var.venue, bookingId, c.req.valid("json").customerId), 200);
  })
  .openapi(route.undoCheckIn, async (c) => {
    const { bookingId, customerId } = c.req.valid("param");
    await undoCheckIn(c.var.venue, bookingId, customerId);
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  });
