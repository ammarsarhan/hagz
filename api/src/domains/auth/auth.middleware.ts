import { createFactory } from "hono/factory";
import { getCookie } from "hono/cookie";

import jwtService from "@/domains/tokens/jwt.service.js";
import type { AccessTokenPayload } from "@/domains/tokens/jwt.service.js";

import { ERROR_CODES, UnauthorizedError } from "@/shared/lib/error.js";

const factory = createFactory<{ Variables: AccessTokenPayload }>();

export const authorize = factory.createMiddleware(
    async (c, next) => {
        const token =
            c.req.header("Authorization")?.replace("Bearer ", "") ||
            getCookie(c, "accessToken");

        if (!token) throw new UnauthorizedError("You must be signed in to access this resource.", ERROR_CODES.USER_NOT_AUTHENTICATED);
        const { id, phone } = await jwtService.verifyAccessToken(token);

        c.set("id", id);
        c.set("phone", phone);

        await next();
    }
);
