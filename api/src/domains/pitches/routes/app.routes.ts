import { Hono } from "hono";
import { getUserPitchHandler, queryPitchesHandler } from "@/domains/pitches/handlers/pitches.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post("/search", ...queryPitchesHandler)
    .get("/:pitchId", ...getUserPitchHandler)

export default app;
export type AppType = typeof app;
