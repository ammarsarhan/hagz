import { Hono } from "hono";
import { bookings } from "./bookings";
import { venues } from "./venues";

// Ungated.
export const open = new Hono().route("/bookings", bookings).route("/venues", venues);
