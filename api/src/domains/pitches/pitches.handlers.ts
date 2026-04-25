import { createFactory } from "hono/factory";

import { authorize } from "@/domains/auth/auth.middleware.js";
import PitchService from "@/domains/pitches/pitches.service.js";
import { createGroundSchema, createPitchSchema } from "@/domains/pitches/pitches.validator.js";

import guard from "@/domains/pitches/pitches.middleware.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { ERROR_CODES, NotFoundError } from "@/shared/lib/error.js";

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
)
