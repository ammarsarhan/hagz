import { Hono } from "hono";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/')

export default app;
export type AppType = typeof app;
