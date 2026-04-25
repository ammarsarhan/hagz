import { Hono } from "hono";

import { createPitchHandler } from "@/domains/pitches/pitches.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createPitchHandler)

export default app;
export type AppType = typeof app;
