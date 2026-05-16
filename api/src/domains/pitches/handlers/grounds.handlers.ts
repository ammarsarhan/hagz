import { createFactory } from "hono/factory";
import GroundService from "@/domains/pitches/services/grounds.service.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";
import guard from "@/domains/pitches/pitches.middleware.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { createGroundSchema, updateGroundSchema, updateGroundSettingsSchema, upsertGroundScheduleSchema } from "../pitches.validator.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";

const factory = createFactory();
const groundService = new GroundService();

export const createGroundHandler = factory.createHandlers(
    guard("layout", PermissionLevel.WRITE),
    validate("json", createGroundSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const payload = c.req.valid("json");
        const ground = await groundService.createGround(pitchId, payload);

        return c.json({ success: true, data: { ground }}, 201);
    }
);

export const getGroundHandler = factory.createHandlers(
    guard("layout", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId || !groundId) throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        const ground = await groundService.fetchGround(pitchId, groundId);

        return c.json({ success: true, data: { ground }}, 200);
    }
);

export const getGroundsHandler = factory.createHandlers(
    guard("layout", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        const grounds = await groundService.fetchGrounds(pitchId);

        return c.json({ success: true, data: { grounds }}, 200);
    }
);

export const updateGroundHandler = factory.createHandlers(
    guard("layout", PermissionLevel.WRITE),
    validate("json", updateGroundSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const payload = c.req.valid("json");
        const ground = await groundService.updateGround(pitchId, groundId, payload);

        return c.json({ success: true, data: { ground } }, 200);
    }
);

export const getGroundSettingsHandler = factory.createHandlers(
    guard("settings", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");

        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const settings = await groundService.getGroundSettings(pitchId, groundId);
        return c.json({ success: true, data: { settings } }, 200);
    }
)

export const updateGroundSettingsHandler = factory.createHandlers(
    guard("settings", PermissionLevel.WRITE),
    validate("json", updateGroundSettingsSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");
        const payload = c.req.valid("json");

        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const settings = await groundService.updateGroundSettings(pitchId, groundId, payload);
        return c.json({ success: true, data: { settings } }, 200);
    }
);

export const upsertGroundScheduleHandler = factory.createHandlers(
    guard("schedule", PermissionLevel.WRITE),
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
        
        const schedule = await groundService.upsertGroundSchedule(pitchId, groundId, parseInt(dayOfWeek), payload);
        return c.json({ success: true, data: { schedule } }, 200);
    }
);

export const fetchGroundScheduleHandler = factory.createHandlers(
    guard("schedule", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");
        const dayOfWeek = c.req.param("dayOfWeek");
        
        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        
        if (!dayOfWeek || parseInt(dayOfWeek) < 1 || parseInt(dayOfWeek) > 7) {
            throw new BadRequestError("Day of week must be a valid number from 1 to 7.", ERROR_CODES.VALIDATION_FAILED);
        }
        
        const schedule = await groundService.fetchGroundSchedule(pitchId, groundId, parseInt(dayOfWeek));
        return c.json({ success: true, data: { schedule } }, 200);
    }
);

export const fetchGroundSchedulesHandler = factory.createHandlers(
    guard("schedule", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const groundId = c.req.param("groundId");
        
        if (!pitchId || !groundId) 
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        
        const schedules = await groundService.fetchGroundSchedules(pitchId, groundId);
        return c.json({ success: true, data: { schedules } }, 200);
    }
);
