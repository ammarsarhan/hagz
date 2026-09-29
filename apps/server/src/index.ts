import { Hono } from "hono";
import { admin } from "@/http/routes/admin";
import { health } from "@/http/routes/health";
import { publicRoutes } from "@/http/routes/public";

const router = new Hono().route("/health", health).route("/public", publicRoutes).route("/admin", admin);

export type AppType = typeof router;
export default router;
