import { createFactory } from "hono/factory";
import { zValidator } from "@hono/zod-validator";

import { authorize } from "@/domains/auth/auth.middleware.js";
import { createPitchSchema } from "@/domains/pitches/pitches.validator.js";
import PitchService from "@/domains/pitches/pitches.service.js";

const factory = createFactory();
const pitchService = new PitchService();

export const createPitchHandler = factory.createHandlers(
    authorize,
    zValidator("json", createPitchSchema),
    async (c) => {
        const userId = c.var.id;
        const payload = c.req.valid("json");

        const pitch = await pitchService.createPitch(userId, payload);

        return c.json({ success: true, data: { pitch }}, 201);
    }
);
