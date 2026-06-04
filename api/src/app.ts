import { Hono } from "hono";
import profile from "@/domains/profile/profile.routes.js";
import bookings from "@/domains/bookings/bookings.routes.js";
import pitches from "@/domains/pitches/routes/app.routes.js";
import locations from "@/domains/locations/locations.routes.js";

const app = new Hono()
    .route('/bookings', bookings)
    .route('/pitches', pitches)
    .route('/profile', profile)
    .route('/locations', locations);
    
export default app;
export type AppType = typeof app;
