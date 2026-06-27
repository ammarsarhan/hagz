// Use the createFactory pattern rather than AuthController as we're used to in Express.
// This is the correct pattern in Hono.

import { createFactory } from "hono/factory";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import AuthService from "@/domains/auth/auth.service.js";
import { authorize } from "@/domains/auth/auth.middleware.js";
import { signUpSchema, signInSchema } from "@/domains/auth/auth.validator.js";
import { ERROR_CODES, UnauthorizedError } from "@/shared/lib/utils/error.js";
import validate from "@/shared/middleware/validate.middleware.js";

const factory = createFactory();
const authService = new AuthService();

export const signUpHandler = factory.createHandlers(
    validate("json", signUpSchema), 
    async (c) => {
        const payload = c.req.valid("json");

        const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0].trim() 
            ?? null;
            
        const userAgent = c.req.header("user-agent") ?? null;

        const isMobile = 
            c.req.header("X-Client-Type") === 'mobile' &&
            !c.req.header('origin');

        await authService.createUser(payload);

        // Exact same flow as the sign in handler to sign in the user directly after signing them up.
        const { user, accessToken, refreshToken } = await authService.signIn(payload, ipAddress, userAgent);
        
        if (!isMobile) {
            setCookie(c, "accessToken", accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                path: "/",
                maxAge: 60 * 15, // 15m
            });

            setCookie(c, "refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                path: "/",
                maxAge: 60 * 60 * 24 * 7 // 7d
            });
        }

        return c.json({ 
            success: true, 
            data: { 
                user,
                accessToken: isMobile ? accessToken : undefined,
                refreshToken: isMobile ? refreshToken : undefined,
            } 
        }, 201);
    }
);

export const signInHandler = factory.createHandlers(
    validate("json", signInSchema),
    async (c) => {
        const payload = c.req.valid("json");

        const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0].trim() 
            ?? null;
            
        const userAgent = c.req.header("user-agent") ?? null;

        // Check if the client is mobile or web:
        // If the client is a web application, we want to provide the access and refresh tokens in secure http-only cookies to prevent XSS attacks.
        // If the client is a mobile application, we do not have a DOM, so we are not vulnerable to XSS attacks but we need a way to store the tokens in the keychain,
        // as such, they sent back within the response body.

        const isMobile = 
            c.req.header("X-Client-Type") === 'mobile' &&
            !c.req.header('origin');

        const { user, accessToken, refreshToken } = await authService.signIn(payload, ipAddress, userAgent);
        
        if (!isMobile) {
            setCookie(c, "accessToken", accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                path: "/",
                maxAge: 60 * 15, // 15m
            });

            setCookie(c, "refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                path: "/",
                maxAge: 60 * 60 * 24 * 7 // 7d
            });
        }

        return c.json({ 
            success: true, 
            data: { 
                user,
                accessToken: isMobile ? accessToken : undefined,
                refreshToken: isMobile ? refreshToken : undefined,
            } 
        }, 200);
    }
);

export const signOutHandler = factory.createHandlers(
    async (c) => {
        const token = 
            getCookie(c, "refreshToken") ||  // Web
            c.req.header("X-Refresh-Token"); // Mobile

        if (!token) return c.json({ success: true }, 200);

        await authService.signOut(token);

        // Clear cookies for web client.
        deleteCookie(c, "accessToken", { path: "/" });
        deleteCookie(c, "refreshToken", { path: "/" });

        return c.json({ success: true }, 200);
    }
);

export const fetchSessionHandler = factory.createHandlers(
    authorize(),
    async (c) => {
        const id = c.var.id;
        const user = await authService.fetchUser({ type: "id", id });

        return c.json({ success: true, data: { user } }, 200);
    }
);

export const refreshSessionHandler = factory.createHandlers(
    async (c) => {
        // Check if mobile to send back the access token in the response body.
        const isMobile = 
            c.req.header("X-Client-Type") === 'mobile' &&
            !c.req.header('origin');

        // If mobile, get the refresh token from the header set by the client, if not get it from the cookies.
        const refreshToken = isMobile ? c.req.header("X-Refresh-Token") : getCookie(c, "refreshToken");
        if (!refreshToken) throw new UnauthorizedError("A refresh token was not provided to create a new access token. Please sign in.", ERROR_CODES.USER_NOT_AUTHENTICATED);

        const { accessToken } = await authService.refreshSession(refreshToken);

        if (!isMobile) {
            setCookie(c, "accessToken", accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                path: "/",
                maxAge: 60 * 15, // 15m
            });
        }

        return c.json({
            success: true,
            message: isMobile ? undefined : "Updated user session successfully.",
            data: isMobile ? { accessToken } : undefined
        }, 200);
    }
);
