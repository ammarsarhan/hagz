import { Hono } from "hono";
import { health } from "@/http/routes/health";

const router = new Hono().route("/health", health);

export type AppType = typeof router;
export default router;
