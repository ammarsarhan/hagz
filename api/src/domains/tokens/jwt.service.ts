import { sign, verify } from "hono/jwt";
import { ERROR_CODES, InternalServerError, UnauthorizedError } from "@/shared/lib/utils/error.js";
import { getUnixTime } from "date-fns";
import { randomUUID } from "crypto";
import { UserRole } from "@/generated/prisma/enums.js";

export interface AccessTokenPayload {
    id: string;
    phone: string;
}

export interface RefreshTokenPayload {
    id: string;
}

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

// This layer will be provided as a singleton as it does not need to be reinstantiated every time we need to call the service.
class JWTService {
    private static service: JWTService;

    private readonly accessSecret: string;
    private readonly refreshSecret: string;

    private readonly ACCESS_TOKEN_EXPIRY_SECONDS = 60 * 15;        // 15m
    private readonly REFRESH_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7d

    private constructor() {
        if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
            throw new InternalServerError(
                "Cannot create JWT service layer without both the access and refresh token secret keys."
            );
        }

        this.accessSecret = process.env.ACCESS_TOKEN_SECRET;
        this.refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    }

    static getService() {
        if (!JWTService.service) JWTService.service = new JWTService();
        return JWTService.service;
    }

    signAccessToken = async (payload: AccessTokenPayload): Promise<string> => {
        return sign(
            { ...payload, jti: randomUUID(), exp: getUnixTime(new Date()) + this.ACCESS_TOKEN_EXPIRY_SECONDS },
            this.accessSecret
        );
    };

    signRefreshToken = async (payload: RefreshTokenPayload): Promise<string> => {
        return sign(
            { ...payload, jti: randomUUID(), exp: getUnixTime(new Date()) + this.REFRESH_TOKEN_EXPIRY_SECONDS },
            this.refreshSecret
        );
    };

    generateTokenPair = async (id: string, phone: string): Promise<TokenPair> => {
        const [accessToken, refreshToken] = await Promise.all([
            this.signAccessToken({ id, phone }),
            this.signRefreshToken({ id }),
        ]);
        return { accessToken, refreshToken };
    };

    verifyAccessToken = async (token: string): Promise<AccessTokenPayload> => {
        try {
            const payload = await verify(token, this.accessSecret, "HS256") as unknown as AccessTokenPayload;
            return payload;
        } catch (error) {
            throw new UnauthorizedError(
                "Access token is invalid or expired. Please refresh the user session.",
                ERROR_CODES.USER_NOT_AUTHENTICATED
            );
        }
    };

    verifyRefreshToken = async (token: string): Promise<RefreshTokenPayload> => {
        try {
            const payload = await verify(token, this.refreshSecret, "HS256") as unknown as RefreshTokenPayload;
            return payload;
        } catch (error) {
            throw new UnauthorizedError(
                "Refresh token is invalid or expired. Please sign in again.",
                ERROR_CODES.USER_SESSION_EXPIRED
            );
        }
    };
}

export default JWTService.getService();
