import { Hono } from "hono";
import pitches from "@/domains/pitches/pitches.routes.js";

const app = new Hono();

app.route('/pitches', pitches);

export default app;
export type AppType = typeof app;