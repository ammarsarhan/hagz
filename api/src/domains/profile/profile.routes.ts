import { Hono } from "hono";
import { fetchProfileNotificationsHandler, readNotificationHandler, getProfileHandler, updateProfileHandler, getPreferencesHandler, updatePreferencesHandler, fetchSessionsHandler, deleteSessionHandler } from "@/domains/profile/profile.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .get("/", ...getProfileHandler)
    .patch("/", ...updateProfileHandler)
    .get("/preferences", ...getPreferencesHandler)
    .patch("/preferences", ...updatePreferencesHandler)
    .get("/notifications", ...fetchProfileNotificationsHandler)
    .patch("/notifications/:notificationId/read", ...readNotificationHandler)
    .get("/sessions", ...fetchSessionsHandler)
    .delete("/sessions/:sessionId", ...deleteSessionHandler)

export default app;
export type AppType = typeof app;
