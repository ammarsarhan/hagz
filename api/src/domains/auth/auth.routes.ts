import { Hono } from "hono";

import { signUpHandler } from "@/domains/auth/auth.handlers.js";

const app = new Hono();

// Chained for RPC type support on the frontend.
app
    .post('/sign-up', ...signUpHandler);

export default app;
export type AppType = typeof app;
