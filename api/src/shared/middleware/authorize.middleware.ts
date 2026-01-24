import { Request, Response, NextFunction } from "express";

import JWTService, { BaseTokenPayload } from "@/domains/jwt/jwt.service";
import sendError from "@/shared/middleware/error.middleware";
import { UnauthorizedError } from "@/shared/lib/error";

declare module "express-serve-static-core" {
    interface Request {
        user?: BaseTokenPayload;
    }
};

export default function authorize(isOptional: boolean = false) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const accessToken = req.cookies.accessToken;
            const refreshToken = req.cookies.refreshToken;

            if (accessToken) {
                const decoded = JWTService.verifyAccessToken(accessToken);
                req.user = decoded;
                return next();
            }
            
            if (refreshToken) {
                const decoded = JWTService.verifyRefreshToken(refreshToken);
                const { id, phone } = decoded;
                
                const token = JWTService.generateAccessToken({ id, phone });

                res.cookie('accessToken', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: 15 * 60 * 1000
                });

                req.user = decoded;
                return next();
            }

            if (isOptional) {
                return next();
            };

            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');
            
            throw new UnauthorizedError("Could not authorize user. Please sign in and try again.");
        } catch (error: any) {
            if (isOptional) {
                return next();
            }

            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');

            sendError(error, req, res, next);
        }
    }
};