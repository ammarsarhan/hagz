import { sign, verify } from "jsonwebtoken"
import { UserRole } from "generated/prisma/enums";

import prisma from "@/shared/lib/prisma";
import { InternalServerError, NotFoundError, UnauthorizedError } from "@/shared/lib/error";
import { addDays, isPast } from "date-fns";

export interface BaseTokenPayload {
    id: string;
    phone: string;
}

export type RefreshTokenPayload = BaseTokenPayload & {
    ipAddress?: string;
    userAgent?: string;
}

export type AccessTokenPayload = BaseTokenPayload & {
    name: string;
    role: UserRole;
    isVerified: boolean;
    isOnboarded: boolean;
}

class TokenService {
    private refreshSecret: string;
    private accessSecret: string;
    private refreshExpiry: any = '7d';
    private accessExpiry: any = '15m';

    constructor () {
        this.refreshSecret = process.env.REFRESH_SECRET!;
        this.accessSecret = process.env.ACCESS_SECRET!;

        if (!this.refreshSecret || !this.accessSecret) throw new InternalServerError("Could not find refresh and access secret keys set in the environment variables.");
    };

    generateRefreshToken = async (payload: RefreshTokenPayload) => {
        const { ipAddress, userAgent, ...user } = payload;
        const token = sign(user, this.refreshSecret, { expiresIn: this.refreshExpiry });

        try {
            await prisma.refreshToken.create({
                data: {
                    token,
                    userId: payload.id,
                    expiresAt: addDays(new Date(), 7),
                    ipAddress,
                    userAgent
                }
            });
            return token;
        } catch {
            throw new InternalServerError("Failed to store refresh token in database.");
        }
    };

    generateAccessToken = (payload: AccessTokenPayload) => {
        const token = sign(payload, this.accessSecret, { expiresIn: this.accessExpiry });
        return token;
    };

    generateTokenPair = async (payload: AccessTokenPayload, meta?: { ipAddress?: string; userAgent?: string }) => {
        const refreshToken = await this.generateRefreshToken({ ...payload, ...meta });
        const accessToken = this.generateAccessToken(payload);

        return { accessToken, refreshToken };
    };
    
    verifyRefreshToken = async (token: string) => {
        const decoded = verify(token, this.refreshSecret) as BaseTokenPayload;

        let record;

        try {
            record = await prisma.refreshToken.findUnique({ where: { token } }); 
        } catch (error) {
            throw new InternalServerError("Could not verify refresh token.")
        };

        if (!record) throw new NotFoundError("Could not find refresh token with the specified token string.");
        if (record.revokedAt != null) throw new UnauthorizedError("The requested refresh token has already been revoked.");
        if (isPast(record.expiresAt)) throw new UnauthorizedError("The requested refresh token has already been expired.");

        return decoded;
    };

    verifyAccessToken = (token: string) => {
        const decoded = verify(token, this.accessSecret) as AccessTokenPayload;
        return decoded;
    };

    revokeRefreshToken = async (token: string) => {
        const result = await prisma.refreshToken.updateMany({ 
            where: { token, revokedAt: null },
            data: { revokedAt: new Date() } 
        });

        return result.count > 0;
    };

    revokeAllRefreshTokens = async (id: string) => {
        return prisma.refreshToken.updateMany({
            where: { userId: id },
            data: { revokedAt: new Date() }
        })
    };

    deleteExpiredRefreshTokens = async () => {
        return prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: new Date() } }
        });
    };
};

export default new TokenService();
