import { Hono } from "hono";
import { fetchPitchesFeedHandler, getUserPitchHandler } from "@/domains/pitches/handlers/pitches.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post("/feed", ...fetchPitchesFeedHandler)
    .get("/:pitchId", ...getUserPitchHandler)

export default app;
export type AppType = typeof app;
