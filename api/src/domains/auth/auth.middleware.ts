import { createFactory } from "hono/factory";
import { getCookie } from "hono/cookie";

import jwtService from "@/domains/tokens/jwt.service.js";

import { ERROR_CODES, UnauthorizedError } from "@/shared/lib/utils/error.js";
import type { AppVariables } from "@/shared/types/context.js";

const factory = createFactory<{ Variables: AppVariables }>();

export const authorize = factory.createMiddleware(
    async (c, next) => {
        // Check whether we are dealing with a mobile or web client and extract the token from the intended source only.
        const isMobile = 
            c.req.header("X-Client-Type") === 'mobile' &&
            !c.req.header('origin');

        let token: string | undefined;

        // If mobile, extract from the Bearer header value and if web, get the cookie.
        if (isMobile) {
            token = c.req.header("Authorization")?.replace("Bearer ", "") 
        } else {
            token = getCookie(c, "accessToken");
        };

        if (!token) throw new UnauthorizedError("You must be signed in to access this resource.", ERROR_CODES.USER_NOT_AUTHENTICATED);
        const { id, phone } = await jwtService.verifyAccessToken(token);

        c.set("id", id);
        c.set("phone", phone);

        await next();
    }
);
