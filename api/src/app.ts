import { Hono } from "hono";
import bookings from "@/domains/bookings/bookings.routes.js";

const app = new Hono();

app.route('/bookings', bookings);
    
export default app;
export type AppType = typeof app;
