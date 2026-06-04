import { Hono } from "hono";
import { getLocationsHandler } from "@/domains/locations/locations.handler.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .get("/", ...getLocationsHandler)

export default app;
export type AppType = typeof app;