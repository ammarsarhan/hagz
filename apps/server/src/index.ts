import { Hono } from "hono";
import { admin } from "@/http/routes/admin";
import { health } from "@/http/routes/health";
import { open } from "@/http/routes/open";

const router = new Hono().route("/health", health).route("/open", open).route("/admin", admin);

export type AppType = typeof router;
export default router;
