import { Hono } from "hono";
import { createUserBookingHandler, fetchBookingHandler } from "@/domains/bookings/bookings.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createUserBookingHandler)
    .get('/:bookingId', ...fetchBookingHandler)

export default app;
export type AppType = typeof app;
