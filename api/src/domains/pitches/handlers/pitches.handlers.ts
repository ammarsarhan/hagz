import { createFactory } from "hono/factory";

import { authorize } from "@/domains/auth/auth.middleware.js";
import PitchService from "@/domains/pitches/services/pitches.service.js";
import { updatePitchSchema, createPitchSchema, fetchPitchAvailabilitySchema, queryPitchesSchema } from "@/domains/pitches/pitches.validator.js";

import guard from "@/domains/pitches/pitches.middleware.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";

const factory = createFactory();
const pitchService = new PitchService();

export const createPitchHandler = factory.createHandlers(
    authorize(),
    validate("json", createPitchSchema),
    async (c) => {
        const userId = c.var.id;
        const payload = c.req.valid("json");

        const pitch = await pitchService.createPitch(userId, payload);

        return c.json({ success: true, data: { pitch }}, 201);
    }
);

export const getUserPitchHandler = factory.createHandlers(
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const pitch = await pitchService.fetchUserPitch(pitchId);
        
        return c.json({ success: true, data: { pitch }}, 200);
    }
);

export const queryPitchesHandler = factory.createHandlers(
    validate("json", queryPitchesSchema),
    async (c) => {
        const filters = c.req.valid("json");
        const pitches = await pitchService.queryPitches(filters);
        return c.json({ success: true, data: { pitches }}, 200);
    }
)

export const getDashboardPitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        const pitch = await pitchService.fetchDashboardPitch(pitchId);
        
        return c.json({ success: true, data: { pitch }}, 200);
    }
);

export const updatePitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    validate("json", updatePitchSchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");
        
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const pitch = await pitchService.updatePitch(pitchId, payload);
        
        return c.json({ success: true, data: { pitch }}, 200);
    }
);

export const submitPitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const pitch = await pitchService.submitPitch(pitchId);
        return c.json({ success: true, data: { pitch } }, 200); 
    }
);

export const deactivatePitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const pitch = await pitchService.deactivatePitch(pitchId);
        return c.json({ success: true, data: { pitch } }, 200); 
    }
);

export const publishPitchHandler = factory.createHandlers(
    guard("properties", PermissionLevel.WRITE),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        const pitch = await pitchService.publishPitch(pitchId);
        return c.json({ success: true, data: { pitch } }, 200); 
    }
);

export const fetchPitchAvailabilityHandler = factory.createHandlers(
    guard("schedule", PermissionLevel.READ),
    validate("query", fetchPitchAvailabilitySchema),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const { date } = c.req.valid("query");

        const availability = await pitchService.fetchAvailability(pitchId, date);
        return c.json({ success: true, data: { availability }}, 200);
    }
);

export const fetchPitchesFeedHandler = factory.createHandlers(
    authorize({ required: false }),
    async (c) => {
        
    }
)
