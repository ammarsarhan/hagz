import { Hono } from "hono";

// Public, ungated. Returns public-safe booking data only.
export const publicBookings = new Hono();
