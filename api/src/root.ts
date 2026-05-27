import { Hono } from "hono";
import auth from "@/domains/auth/auth.routes.js";
import { serverAdapter } from "@/internal/bullboard.js";

const app = new Hono();

app.route('/auth', auth);
app.route("/queues", serverAdapter.registerPlugin());
app.get('/health', async (c) => c.json({ success: true, data: { status: "ok" } }, 200));

export default app;
export type AppType = typeof app;