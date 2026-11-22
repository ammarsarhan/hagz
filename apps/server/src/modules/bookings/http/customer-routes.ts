import { replayHeaders } from "@/platform/idempotency/idempotency";
import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { bookingView } from "../application/booking-view";
import { createBooking, quoteBooking } from "../application/create-booking";
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
  });
