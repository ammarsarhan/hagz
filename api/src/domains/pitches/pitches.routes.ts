import { Hono } from "hono";

import { createPitchHandler, getPitchHandler, createGroundHandler, getGroundHandler, getGroundsHandler } from "@/domains/pitches/pitches.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createPitchHandler)
    .get('/:pitchId', ...getPitchHandler)
    .post('/:pitchId/grounds', ...createGroundHandler)
    .get('/:pitchId/grounds/:groundId', ...getGroundHandler)
    .get('/:pitchId/grounds', ...getGroundsHandler)

export default app;
export type AppType = typeof app;
