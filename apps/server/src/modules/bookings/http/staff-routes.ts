import { createRouter } from "@/platform/http/router";
import { confirmHold, createHold, extendHold, releaseHold } from "../application/holds";
import { moveBooking, swapBookings } from "../application/rescheduling";
import {
  listVenueBookings,
  pendingBookings,
  staffBookingDetail,
  venueBookingHistory,
} from "../application/staff-bookings";
import { approveBooking, declineBooking, markBooking } from "../application/staff-decisions";
import * as route from "./definitions/staff";

// `pending` is registered before `{bookingId}`, which would otherwise match it.
export const bookingsStaffRoutes = createRouter()
  .openapi(route.listBookings, async (c) =>
    c.json({ data: await listVenueBookings(c.var.venue, c.req.valid("query")) }, 200),
  )
  .openapi(route.pendingBookings, async (c) =>
    c.json({ data: await pendingBookings(c.var.venue) }, 200),
  )
  .openapi(route.getBooking, async (c) =>
    c.json(await staffBookingDetail(c.var.venue.venueId, c.req.valid("param").bookingId), 200),
  )
  .openapi(route.bookingHistory, async (c) =>
    c.json(
      await venueBookingHistory(c.var.venue, c.req.valid("param").bookingId, c.req.valid("query")),
      200,
    ),
  )
  .openapi(route.approveBooking, async (c) => {
    const { bookingId } = c.req.valid("param");
    await approveBooking(c.var.venue, bookingId);
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  })
  .openapi(route.declineBooking, async (c) => {
    const { bookingId } = c.req.valid("param");
    await declineBooking(c.var.venue, bookingId, c.req.valid("json"));
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  })
  .openapi(route.markBooking, async (c) => {
    const { bookingId } = c.req.valid("param");
    await markBooking(c.var.venue, bookingId, c.req.valid("json"));
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  })
  .openapi(route.moveBooking, async (c) => {
    const { bookingId } = c.req.valid("param");
    const id = await moveBooking(c.var.venue, bookingId, c.req.valid("json"));
    return c.json(await staffBookingDetail(c.var.venue.venueId, id), 200);
  })
  .openapi(route.swapBookings, async (c) => {
    const { bookingId } = c.req.valid("param");
    const [mine, theirs] = await swapBookings(c.var.venue, bookingId, c.req.valid("json"));
    const { venueId } = c.var.venue;
    return c.json(
      {
        data: [
          await staffBookingDetail(venueId, mine),
          await staffBookingDetail(venueId, theirs),
        ] as const,
      },
      200,
    );
  })
  .openapi(route.createHold, async (c) => {
    const id = await createHold(c.var.venue, c.req.valid("json"));
    return c.json(await staffBookingDetail(c.var.venue.venueId, id), 201);
  })
  .openapi(route.confirmHold, async (c) => {
    const { bookingId } = c.req.valid("param");
    await confirmHold(c.var.venue, bookingId);
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  })
  .openapi(route.extendHold, async (c) => {
    const { bookingId } = c.req.valid("param");
    await extendHold(c.var.venue, bookingId);
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  })
  .openapi(route.releaseHold, async (c) => {
    const { bookingId } = c.req.valid("param");
    await releaseHold(c.var.venue, bookingId);
    return c.json(await staffBookingDetail(c.var.venue.venueId, bookingId), 200);
  });
