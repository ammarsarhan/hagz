import { Hono } from "hono";

import { fetchSessionHandler, refreshSessionHandler, signInHandler, signOutHandler, signUpHandler } from "@/domains/auth/auth.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/sign-up', ...signUpHandler)
    .post('/sign-in', ...signInHandler)
    .post('/sign-out', ...signOutHandler)
    .post('/refresh', ...refreshSessionHandler)
    .get('/session', ...fetchSessionHandler)
    
export default app;
export type AppType = typeof app;
