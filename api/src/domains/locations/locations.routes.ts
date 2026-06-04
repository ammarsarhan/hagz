import { Hono } from "hono";
import { fetchLocationsHandler } from "@/domains/locations/locations.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .get("/", ...fetchLocationsHandler);

export default app;
export type AppType = typeof app;
