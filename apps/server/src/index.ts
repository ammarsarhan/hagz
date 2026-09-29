import { Hono } from "hono";
import { admin } from "@/http/routes/admin";
import { health } from "@/http/routes/health";
import { publicBookings } from "@/http/routes/public/bookings";
import { publicVenues } from "@/http/routes/public/venues";

const router = new Hono()
  .route("/health", health)
  .route("/public/bookings", publicBookings)
  .route("/public/venues", publicVenues)
  .route("/admin", admin);

export type AppType = typeof router;
export default router;
