import { Hono } from "hono";
import { publicBookings } from "./bookings";
import { publicVenues } from "./venues";

// Public, ungated.
export const publicRoutes = new Hono().route("/bookings", publicBookings).route("/venues", publicVenues);
