import { bookingView } from "@/modules/bookings";
import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { startCheckout } from "../application/checkout";
import { ownPayment, settlePayment } from "../application/settle";
import * as route from "./definitions/customer";

export const paymentsCustomerRoutes = createRouter().openapi(route.startCheckout, async (c) => {
  const { checkout, replayed } = await startCheckout(
    c.get("customer").customerId,
    c.req.valid("param").bookingId,
    c.req.valid("json"),
    c.req.valid("header")["idempotency-key"],
  );
  return c.json(checkout, 201, replayed ? { "Idempotent-Replayed": "true" } : {});
});

// Mounted only while the provider is the stand-in, outside production (http/router.ts).
export const paymentsDevRoutes = createRouter()
  .openapi(route.succeedPayment, async (c) => {
    const { paymentId } = c.req.valid("param");
    await ownPayment(c.get("customer").customerId, paymentId);
    const { bookingId } = await settlePayment(paymentId, "SUCCEEDED");
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  })
  .openapi(route.failPayment, async (c) => {
    const { paymentId } = c.req.valid("param");
    await ownPayment(c.get("customer").customerId, paymentId);
    const { bookingId } = await settlePayment(paymentId, "FAILED");
    return c.json(await bookingView(bookingId, requestLanguage(c)), 200);
  });
