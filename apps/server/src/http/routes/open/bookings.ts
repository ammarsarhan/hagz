import { Hono } from "hono";

// Public, ungated. Returns public-safe booking data only.
export const bookings = new Hono();
