import { bookingSettings, updateBookingSettings } from "@/modules/venues";
import { createRouter } from "@/platform/http/router";
import {
  createRegular,
  endRegular,
  followBookingSettings,
  listRegulars,
  orderRegulars,
  pauseRegular,
  regularDetail,
  resumeRegular,
  updateRegular,
} from "../application/regulars";
import { slotCandidates } from "../application/fill-slot";
import { confirmReservation, releaseReservation } from "../application/reservations";
import { staffBookingDetail } from "../application/staff-bookings";
import * as settings from "./definitions/booking-settings";
import * as route from "./definitions/regulars";

// `order` is registered before `{regularId}` so it isn't read as an id.
export const bookingsRegularRoutes = createRouter()
  .openapi(route.listRegulars, async (c) => c.json(await listRegulars(c.var.venue), 200))
  .openapi(route.orderRegulars, async (c) =>
    c.json(await orderRegulars(c.var.venue, c.req.valid("json")), 200),
  )
  .openapi(route.createRegular, async (c) =>
    c.json(await createRegular(c.var.venue, c.req.valid("json")), 201),
  )
  .openapi(route.getRegular, async (c) =>
    c.json(await regularDetail(c.var.venue, c.req.valid("param").regularId), 200),
  )
  .openapi(route.updateRegular, async (c) =>
    c.json(
      await updateRegular(c.var.venue, c.req.valid("param").regularId, c.req.valid("json")),
      200,
    ),
  )
  .openapi(route.pauseRegular, async (c) =>
    c.json(await pauseRegular(c.var.venue, c.req.valid("param").regularId), 200),
  )
  .openapi(route.resumeRegular, async (c) =>
    c.json(await resumeRegular(c.var.venue, c.req.valid("param").regularId), 200),
  )
  .openapi(route.endRegular, async (c) =>
    c.json(await endRegular(c.var.venue, c.req.valid("param").regularId), 200),
  )
  .openapi(route.confirmReservation, async (c) => {
    const { bookingId } = c.req.valid("param");
    await confirmReservation({ staff: c.var.venue }, bookingId);
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  })
  .openapi(route.releaseReservation, async (c) => {
    const { bookingId } = c.req.valid("param");
    await releaseReservation({ staff: c.var.venue }, bookingId);
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  })
  .openapi(route.slotCandidates, async (c) =>
    c.json(
      await slotCandidates(c.var.venue, c.req.valid("param").slotId, c.req.valid("query")),
      200,
    ),
  )
  .openapi(settings.getBookingSettings, async (c) =>
    c.json(await bookingSettings(c.var.venue), 200),
  )
  .openapi(settings.updateBookingSettings, async (c) => {
    const { previous, settings: next } = await updateBookingSettings(
      c.var.venue,
      c.req.valid("json"),
    );
    await followBookingSettings(c.var.venue.venueId, previous, next);
    return c.json(next, 200);
  });
