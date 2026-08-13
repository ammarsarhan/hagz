import { Hono } from "hono";
import { fetchProfileNotificationsHandler, readNotificationHandler, readNotificationsHandler, getProfileHandler, updateProfileHandler, createAvatarPresignLinkHandler, confirmAvatarUploadHandler, getPreferencesHandler, updatePreferencesHandler, fetchSessionsHandler, deleteSessionHandler, transferAccountHandler } from "@/domains/profile/profile.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .get("/", ...getProfileHandler)
    .patch("/", ...updateProfileHandler)
    .post('/avatar/presign', ...createAvatarPresignLinkHandler)
    .post('/avatar/:avatarId/confirm', ...confirmAvatarUploadHandler)
    .get("/preferences", ...getPreferencesHandler)
    .patch("/preferences", ...updatePreferencesHandler)
    .post("/transfer", ...transferAccountHandler)
    .get("/notifications", ...fetchProfileNotificationsHandler)
    .patch("/notifications/read", ...readNotificationsHandler)
    .patch("/notifications/:notificationId/read", ...readNotificationHandler)
    .get("/sessions", ...fetchSessionsHandler)
    .delete("/sessions/:sessionId", ...deleteSessionHandler)

export default app;
export type AppType = typeof app;
