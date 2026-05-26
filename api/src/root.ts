import { Hono } from "hono";
import auth from "@/domains/auth/auth.routes.js";
import { serverAdapter } from "@/internal/bullboard.js";

const app = new Hono();

app.route('/auth', auth);
app.route("/queues", serverAdapter.registerPlugin());

export default app;
export type AppType = typeof app;