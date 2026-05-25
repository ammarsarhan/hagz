import { Hono } from "hono";
import profile from "@/domains/profile/profile.routes.js";
import bookings from "@/domains/bookings/bookings.routes.js";
import pitches from "@/domains/pitches/routes/app.routes.js";

const app = new Hono();

app.route('/bookings', bookings);
app.route('/pitches', pitches);
app.route('/profile', profile);
    
export default app;
export type AppType = typeof app;
