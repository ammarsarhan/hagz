import { Hono } from "hono";
import { createUserBookingHandler, fetchUserBookingHandler, fetchUserBookingsHandler } from "@/domains/bookings/bookings.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createUserBookingHandler)
    .get('/', ...fetchUserBookingsHandler)
    .get('/:bookingId', ...fetchUserBookingHandler)

export default app;
export type AppType = typeof app;
