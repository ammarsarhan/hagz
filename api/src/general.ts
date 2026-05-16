import { Hono } from "hono";
import auth from "@/domains/auth/auth.routes.js";
import bookings from "@/domains/bookings/bookings.routes.js";

const app = new Hono();

app.route('/auth', auth);
app.route('/bookings', bookings);
    
export default app;
export type AppType = typeof app;
