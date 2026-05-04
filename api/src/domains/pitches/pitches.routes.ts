import { Hono } from "hono";

import { 
    createPitchHandler, 
    getPitchHandler, 
    createGroundHandler, 
    getGroundHandler, 
    getGroundsHandler, 
    updateGroundHandler,
    getGroundSettingsHandler,
    updateGroundSettingsHandler,
    upsertGroundScheduleHandler,
    fetchGroundScheduleHandler,
    fetchGroundSchedulesHandler,
    getPitchAmenityHandler,
    getPitchAmenitiesHandler,
    createPitchAmenityHandler,
    updatePitchAmenityHandler,
    deletePitchAmenityHandler,
    createPitchMediaPresignLinkHandler,
    confirmPitchMediaUploadHandler,
    submitPitchHandler
} from "@/domains/pitches/pitches.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createPitchHandler)
    .get('/:pitchId', ...getPitchHandler)
    .get('/:pitchId/amenities', ...getPitchAmenitiesHandler)
    .post('/:pitchId/amenities', ...createPitchAmenityHandler)
    .get('/:pitchId/amenities/:order', ...getPitchAmenityHandler)
    .patch('/:pitchId/amenities/:order', ...updatePitchAmenityHandler)
    .delete('/:pitchId/amenities/:order', ...deletePitchAmenityHandler)
    .post('/:pitchId/grounds', ...createGroundHandler)
    .get('/:pitchId/grounds/:groundId', ...getGroundHandler)
    .get('/:pitchId/grounds', ...getGroundsHandler)
    .patch('/:pitchId/grounds/:groundId', ...updateGroundHandler)
    .get('/:pitchId/grounds/:groundId/settings', ...getGroundSettingsHandler)
    .patch('/:pitchId/grounds/:groundId/settings', ...updateGroundSettingsHandler)
    .get('/:pitchId/grounds/:groundId/schedule', ...fetchGroundSchedulesHandler)
    .put('/:pitchId/grounds/:groundId/schedule/:dayOfWeek', ...upsertGroundScheduleHandler)
    .get('/:pitchId/grounds/:groundId/schedule/:dayOfWeek', ...fetchGroundScheduleHandler)
    .post('/:pitchId/media/presign', ...createPitchMediaPresignLinkHandler)
    .post('/:pitchId/media/:mediaId/confirm', ...confirmPitchMediaUploadHandler)
    .post('/:pitchId/submit', ...submitPitchHandler)

export default app;
export type AppType = typeof app;
