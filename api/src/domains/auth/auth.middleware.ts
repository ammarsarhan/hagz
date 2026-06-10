import { createFactory } from "hono/factory";
import { getCookie } from "hono/cookie";

import jwtService from "@/domains/tokens/jwt.service.js";

import { ERROR_CODES, UnauthorizedError } from "@/shared/lib/utils/error.js";
import type { AppVariables } from "@/shared/types/context.js";

const factory = createFactory<{ Variables: AppVariables }>();

export const authorize = (options: { required?: boolean } = { required: true }) => 
    factory.createMiddleware(async (c, next) => {
        const isMobile = 
            c.req.header("X-Client-Type") === 'mobile' &&
            !c.req.header('origin');

        let token: string | undefined;

        if (isMobile) {
            token = c.req.header("Authorization")?.replace("Bearer ", "");
        } else {
            token = getCookie(c, "accessToken");
        }

        if (!token) {
            if (options.required) {
                throw new UnauthorizedError("You must be signed in to access this resource.", ERROR_CODES.USER_NOT_AUTHENTICATED);
            }
            return await next();
        }

        try {
            const { id, phone } = await jwtService.verifyAccessToken(token);
            c.set("id", id);
            c.set("phone", phone);
        } catch (error) {
            if (options.required) throw error;
        }

        await next();
    });
