import { Hono } from "hono";
import pitches from "@/domains/pitches/routes/dashboard.routes.js";

const app = new Hono()
  .route('/pitches', pitches);

export default app;
export type AppType = typeof app;