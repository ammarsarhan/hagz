// Use the createFactory pattern rather than AuthController as we're used to in Express.
// This is the correct pattern in Hono.

import { createFactory } from "hono/factory";
import { zValidator } from "@hono/zod-validator";

import AuthService from "@/domains/auth/auth.service.js";
import { signUpSchema, signInSchema } from "@/domains/auth/auth.validator.js";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const factory = createFactory();
const authService = new AuthService();

export const signUpHandler = factory.createHandlers(
    zValidator("json", signUpSchema), 
    async (c) => {
        const payload = c.req.valid("json");
        const user = await authService.createUser(payload);
        return c.json({ success: true, data: user }, 201);
    }
);

export const signInHandler = factory.createHandlers(
    zValidator("json", signInSchema),
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
        
        if (isMobile) {
            return c.json({ success: true, data: { user, accessToken, refreshToken }}, 200);
        };

        setCookie(c, "accessToken", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "Strict",
            path: "/",
            maxAge: 60 * 15,         // 15m
        });

        setCookie(c, "refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "Strict",
            path: "/auth/refresh",   // Scoped such that the browser only sends it to this route.
            maxAge: 60 * 60 * 24 * 7 // 7d
        });

        return c.json({ success: true, data: { user } }, 200);
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
        deleteCookie(c, "refreshToken", { path: "/auth/refresh" });

        return c.json({ success: true }, 200);
    }
)