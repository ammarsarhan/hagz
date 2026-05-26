import { Hono } from "hono";
import { fetchProfileNotificationsHandler, readNotificationHandler } from "@/domains/profile/profile.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .get("/")
    .patch("/")
    .get("/settings")
    .patch("/settings")
    .get("/notifications", ...fetchProfileNotificationsHandler)
    .patch("/notifications/:notificationId/read", ...readNotificationHandler)
    .get("/sessions")
    .delete("/sessions/:sessionId")
    .get("/history")

export default app;
export type AppType = typeof app;
