import { Hono } from "hono";
import bookings from "@/domains/bookings/bookings.routes.js";
import pitches from "@/domains/pitches/routes/app.routes.js";

const app = new Hono();

app.route('/bookings', bookings);
app.route('/pitches', pitches);
    
export default app;
export type AppType = typeof app;
