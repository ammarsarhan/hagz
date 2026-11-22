import { replayHeaders } from "@/platform/idempotency/idempotency";
import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { bookingView } from "../application/booking-view";
import { createBooking, quoteBooking } from "../application/create-booking";
import { acceptMove, moveBack, rejectMove } from "../application/move-response";
import { ensureMyBooking, listMyBookings } from "../application/my-bookings";
import { sharedBooking } from "../application/shared-booking";
import * as route from "./definitions/customer";

export const bookingsCustomerRoutes = createRouter()
  .openapi(route.quoteBooking, async (c) => {
    return c.json(await quoteBooking(c.req.valid("json"), requestLanguage(c)), 200);
  })
  .openapi(route.createBooking, async (c) => {
    const result = await createBooking(
      c.get("customer").customerId,
      c.req.valid("json"),
      c.req.valid("header")["idempotency-key"],
    );
    return c.json(await bookingView(result.value, requestLanguage(c)), 201, replayHeaders(result));
  })
  .openapi(route.listBookings, async (c) => {
    const page = await listMyBookings(
      c.get("customer").customerId,
      c.req.valid("query"),
      requestLanguage(c),
    );
    return c.json(page, 200);
  })
  .openapi(route.getBooking, async (c) => {
    const { bookingId } = c.req.valid("param");
    await ensureMyBooking(c.get("customer").customerId, bookingId);
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  })
  .openapi(route.acceptMove, async (c) => {
    const { bookingId } = c.req.valid("param");
    await acceptMove(c.get("customer").customerId, bookingId);
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  })
  .openapi(route.rejectMove, async (c) => {
    const { bookingId } = c.req.valid("param");
    await rejectMove(c.get("customer").customerId, bookingId);
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  })
  .openapi(route.moveBack, async (c) => {
    const { bookingId } = c.req.valid("param");
    const id = await moveBack(c.get("customer").customerId, bookingId);
    return c.json(await bookingView(id, requestLanguage(c)), 200);
  })
  .openapi(route.sharedBooking, async (c) => {
    return c.json(await sharedBooking(c.req.valid("param").code, requestLanguage(c)), 200);
  });
