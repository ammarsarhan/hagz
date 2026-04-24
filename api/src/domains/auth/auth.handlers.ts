// Use the createFactory pattern rather than AuthController as we're used to in Express.
// This is the correct pattern in Hono.

import { createFactory } from "hono/factory";
import { zValidator } from "@hono/zod-validator";

import AuthService from "@/domains/auth/auth.service.js";
import { signUpSchema } from "@/domains/auth/auth.validator.js";

const factory = createFactory();
const authService = new AuthService();

export const signUpHandler = factory.createHandlers(
    zValidator("json", signUpSchema), 
    async (c) => {
        const payload = c.req.valid("json");
        const user = await authService.createUser(payload);
        return c.json({ success: true, data: user }, 201);
    }
)