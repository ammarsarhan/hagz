import { Hono } from "hono";

import { 
    createPitchHandler, 
    getPitchHandler, 
    createGroundHandler, 
    getGroundHandler, 
    getGroundsHandler, 
    updateGroundHandler,
    getGroundSettingsHandler,
    updateGroundSettingsHandler
} from "@/domains/pitches/pitches.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createPitchHandler)
    .get('/:pitchId', ...getPitchHandler)
    .post('/:pitchId/grounds', ...createGroundHandler)
    .get('/:pitchId/grounds/:groundId', ...getGroundHandler)
    .get('/:pitchId/grounds', ...getGroundsHandler)
    .patch('/:pitchId/grounds/:groundId', ...updateGroundHandler)
    .get('/:pitchId/grounds/:groundId/settings', ...getGroundSettingsHandler)
    .patch('/:pitchId/grounds/:groundId/settings', ...updateGroundSettingsHandler)

export default app;
export type AppType = typeof app;
