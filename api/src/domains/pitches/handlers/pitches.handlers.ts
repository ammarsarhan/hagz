import { createFactory } from "hono/factory";

import { authorize } from "@/domains/auth/auth.middleware.js";
import PitchService from "@/domains/pitches/services/pitches.service.js";
import { updatePitchSchema, createPitchSchema } from "@/domains/pitches/pitches.validator.js";

import guard from "@/domains/pitches/pitches.middleware.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import { PermissionLevel } from "@/generated/prisma/enums.js";

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
    guard("properties", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        if (!pitchId) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        const pitch = await pitchService.fetchPitch(pitchId);
        
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
