import { Hono } from "hono";
import auth from "@/domains/auth/auth.routes.js";

const app = new Hono();

app.route('/auth', auth);

export default app;
export type AppType = typeof app;