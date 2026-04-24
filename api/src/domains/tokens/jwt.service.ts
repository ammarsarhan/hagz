import { sign, verify } from "hono/jwt";
import { InternalServerError } from "@/shared/lib/error.js";

interface AccessTokenPayload {
    id: string;
    phone: string;
}

interface RefreshTokenPayload {
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
            { ...payload, exp: Math.floor(Date.now() / 1000) + this.ACCESS_TOKEN_EXPIRY_SECONDS },
            this.accessSecret
        );
    };

    signRefreshToken = async (payload: RefreshTokenPayload): Promise<string> => {
        return sign(
            { ...payload, exp: Math.floor(Date.now() / 1000) + this.REFRESH_TOKEN_EXPIRY_SECONDS },
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
        return verify(token, this.accessSecret, "HS256") as unknown as Promise<AccessTokenPayload>;
    };

    verifyRefreshToken = async (token: string): Promise<RefreshTokenPayload> => {
        return verify(token, this.refreshSecret, "HS256") as unknown as Promise<RefreshTokenPayload>;
    };
}

export default JWTService.getService();