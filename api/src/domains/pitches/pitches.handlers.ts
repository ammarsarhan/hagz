import { createFactory } from "hono/factory";

import PitchService from "@/domains/pitches/pitches.service.js";
import validate from "@/shared/middleware/validate.middleware.js";
import { authorize } from "@/domains/auth/auth.middleware.js";
import { createPitchSchema } from "@/domains/pitches/pitches.validator.js";

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
