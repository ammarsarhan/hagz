import { Hono } from "hono";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .get("/")
    .patch("/")
    .get("/settings")
    .patch("/settings")
    .get("/notifications")
    .patch("/notifications/:notificationId/read")
    .get("/sessions")
    .delete("/sessions/:sessionId")
    .get("/history")

export default app;
export type AppType = typeof app;
