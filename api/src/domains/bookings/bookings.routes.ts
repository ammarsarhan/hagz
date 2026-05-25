import { Hono } from "hono";
import { createUserBookingHandler, fetchUserBookingHandler, cancelUserBookingHandler, rescheduleUserBookingHandler } from "@/domains/bookings/bookings.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createUserBookingHandler)
    .get('/:bookingId', ...fetchUserBookingHandler)
    .post('/:bookingId/cancel', ...cancelUserBookingHandler)
    .post('/:bookingId/reschedule', ...rescheduleUserBookingHandler)

export default app;
export type AppType = typeof app;
