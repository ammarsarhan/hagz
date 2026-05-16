import { Hono } from "hono";
import { fetchBookingHandler } from "@/domains/bookings/bookings.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .get('/:bookingId', ...fetchBookingHandler)

export default app;
export type AppType = typeof app;
