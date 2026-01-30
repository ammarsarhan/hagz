import { Request, Response, NextFunction } from "express";

import JWTService, { BaseTokenPayload } from "@/domains/jwt/jwt.service";
import AuthService from "@/domains/auth/auth.service";
import sendError from "@/shared/middleware/error.middleware";
import { UnauthorizedError } from "@/shared/lib/error";

declare module "express-serve-static-core" {
    interface Request {
        user?: BaseTokenPayload;
    }
}

const authService = new AuthService();

export default function authorize(isOptional: boolean = false) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;

        let decoded: BaseTokenPayload | null = null;

        if (accessToken) {
            try {
                decoded = JWTService.verifyAccessToken(accessToken);
            } catch {
                decoded = null;
            }
        }

        if (!decoded && refreshToken) {
            try {
                const token = await authService.refreshSessionToken(refreshToken);
                
                res.cookie("accessToken", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: 15 * 60 * 1000,
                });
                
                decoded = JWTService.verifyAccessToken(token);
            } catch {
                decoded = null;
            }
        }

        if (decoded) {
            req.user = decoded;
            return next();
        }

        if (isOptional) {
            return next();
        }

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        return sendError(
            new UnauthorizedError("Could not authorize user. Please sign in and try again."),
            req,
            res,
            next
        );
    };
}
