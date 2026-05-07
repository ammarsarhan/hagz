import { createFactory } from "hono/factory";

import { authorize } from "@/domains/auth/auth.middleware.js";
import PitchService from "@/domains/pitches/pitches.service.js";
import { createGroundSchema, createPitchAmenitySchema, updatePitchSchema, createPitchMediaPresignLinkSchema, createPitchSchema, updateGroundSchema, updateGroundSettingsSchema, updatePitchAmenitySchema, upsertGroundScheduleSchema, createInvitationSchema } from "@/domains/pitches/pitches.validator.js";

import guard from "@/domains/pitches/pitches.middleware.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";

const factory = createFactory();
const pitchService = new PitchService();

export const createPitchHandler = factory.createHandlers(
    authorize,
    validate("json", createPitchSchema),
    async (c) => {
        const userId = c.var.id;
        const payload = c.req.valid("json");

        const pitch = await pitchService.createPitch(userId, payload);

        return c.json({ success: true, data: { pitch }}, 201);
    }
);

export const getPitchHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        const pitch = await pitchService.fetchPitch(pitchId);
        
        return c.json({ success: true, data: { pitch }}, 200);
    }
);

export const updatePitchHandler = factory.createHandlers(
    guard,
    validate("json", updatePitchSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");
        
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const pitch = await pitchService.updatePitch(pitchId, payload);
        
        return c.json({ success: true, data: { pitch }}, 200);
    }
)

export const createGroundHandler = factory.createHandlers(
    guard,
    validate("json", createGroundSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const payload = c.req.valid("json");
        const ground = await pitchService.createGround(pitchId, payload);

        return c.json({ success: true, data: { ground }}, 201);
    }
);

export const getGroundHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId || !groundId) throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        const ground = await pitchService.fetchGround(pitchId, groundId);

        return c.json({ success: true, data: { ground }}, 200);
    }
);

export const getGroundsHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        const grounds = await pitchService.fetchGrounds(pitchId);

        return c.json({ success: true, data: { grounds }}, 200);
    }
);

export const updateGroundHandler = factory.createHandlers(
    guard,
    validate("json", updateGroundSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const payload = c.req.valid("json");
        const ground = await pitchService.updateGround(pitchId, groundId, payload);

        return c.json({ success: true, data: { ground } }, 200);
    }
);

export const getGroundSettingsHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const settings = await pitchService.getGroundSettings(pitchId, groundId);
        return c.json({ success: true, data: { settings } }, 200);
    }
)

export const updateGroundSettingsHandler = factory.createHandlers(
    guard,
    validate("json", updateGroundSettingsSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");
        const payload = c.req.valid("json");

        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const settings = await pitchService.updateGroundSettings(pitchId, groundId, payload);
        return c.json({ success: true, data: { settings } }, 200);
    }
);

export const upsertGroundScheduleHandler = factory.createHandlers(
    guard,
    validate("json", upsertGroundScheduleSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");
        const dayOfWeek = c.req.param("dayOfWeek");
        
        const payload = c.req.valid("json");
        
        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        
        if (!dayOfWeek || parseInt(dayOfWeek) < 1 || parseInt(dayOfWeek) > 7) {
            throw new BadRequestError("Day of week must be a valid number from 1 to 7.", ERROR_CODES.VALIDATION_FAILED);
        }
        
        const schedule = await pitchService.upsertGroundSchedule(pitchId, groundId, parseInt(dayOfWeek), payload);
        return c.json({ success: true, data: { schedule } }, 200);
    }
);

export const fetchGroundScheduleHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");
        const dayOfWeek = c.req.param("dayOfWeek");
        
        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        
        if (!dayOfWeek || parseInt(dayOfWeek) < 1 || parseInt(dayOfWeek) > 7) {
            throw new BadRequestError("Day of week must be a valid number from 1 to 7.", ERROR_CODES.VALIDATION_FAILED);
        }
        
        const schedule = await pitchService.fetchGroundSchedule(pitchId, groundId, parseInt(dayOfWeek));
        return c.json({ success: true, data: { schedule } }, 200);
    }
);

export const fetchGroundSchedulesHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");
        
        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        
        const schedules = await pitchService.fetchGroundSchedules(pitchId, groundId);
        return c.json({ success: true, data: { schedules } }, 200);
    }
);

export const getPitchAmenityHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const order = c.req.param("order");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!order || parseInt(order) < 1 || parseInt(order) > 10)
            throw new BadRequestError("Amenity order must be a valid number from 1 to 10.", ERROR_CODES.VALIDATION_FAILED);
        
        const amenity = await pitchService.fetchPitchAmenity(pitchId, parseInt(order));
        return c.json({ success: true, data: { amenity } }, 200);
    }
);

export const getPitchAmenitiesHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const amenities = await pitchService.fetchPitchAmenities(pitchId);
        return c.json({ success: true, data: { amenities } }, 200);
    }
);

export const createPitchAmenityHandler = factory.createHandlers(
    guard,
    validate("json", createPitchAmenitySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const amenity = await pitchService.createPitchAmenity(pitchId, payload);
        return c.json({ success: true, data: { amenity } }, 200);
    }
);

export const updatePitchAmenityHandler = factory.createHandlers(
    guard,
    validate("json", updatePitchAmenitySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const order = c.req.param("order");
        const payload = c.req.valid("json");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!order || parseInt(order) < 1 || parseInt(order) > 10)
            throw new BadRequestError("Amenity order must be a valid number from 1 to 10.", ERROR_CODES.VALIDATION_FAILED);

        const amenity = await pitchService.updatePitchAmenity(pitchId, parseInt(order), payload);
        return c.json({ success: true, data: { amenity } }, 200);
    }
);

export const deletePitchAmenityHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const order = c.req.param("order");

        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!order || parseInt(order) < 1 || parseInt(order) > 10)
            throw new BadRequestError("Amenity order must be a valid number from 1 to 10.", ERROR_CODES.VALIDATION_FAILED);

        await pitchService.deletePitchAmenity(pitchId, parseInt(order));
        return c.json({ success: true, data: null }, 200);
    }
);

export const createPitchMediaPresignLinkHandler = factory.createHandlers(
    guard,
    validate("json", createPitchMediaPresignLinkSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");

        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const { url, id } = await pitchService.generatePitchMediaPresignLink(pitchId, payload);

        return c.json({ success: true, data: { url, id } }, 200); 
    }
);

export const confirmPitchMediaUploadHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const mediaId = c.req.param("mediaId");

        if (!pitchId)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!mediaId)
            throw new NotFoundError("Could not find media with the specified ID.", ERROR_CODES.PITCH_MEDIA_NOT_FOUND);

        const media = await pitchService.confirmPitchMediaUpload(pitchId, mediaId);
        return c.json({ success: true, data: { media } }, 200); 
    }
);

export const submitPitchHandler = factory.createHandlers(
    guard,
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const pitch = await pitchService.submitPitch(pitchId);
        return c.json({ success: true, data: { pitch } }, 200); 
    }
);

export const createPitchInvitationHandler = factory.createHandlers(
    guard,
    validate("json", createInvitationSchema),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");
        
        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const invitation = await pitchService.createInvitation(pitchId, userId, payload);
        return c.json({ success: true, data: { invitation }}, 201);
    }
)
