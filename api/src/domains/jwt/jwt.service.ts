import { InternalServerError } from "@/shared/error";
import { sign, verify } from "jsonwebtoken"

export interface BaseTokenPayload {
    id: string;
    phone: string;
}

export default class JWTService {
    private refreshSecret: string;
    private accessSecret: string;
    private refreshExpiry: any = '15m';
    private accessExpiry: any = '7d';

    constructor () {
        this.refreshSecret = process.env.REFRESH_SECRET!;
        this.accessSecret = process.env.ACCESS_SECRET!;

        if (!this.refreshSecret || !this.accessSecret) throw new InternalServerError("Could not find refresh and access secret keys set in the environment variables.");
    };

    generateRefreshToken = (payload: BaseTokenPayload) => {
        const token = sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiry });
        return token;
    };

    generateAccessToken = (payload: BaseTokenPayload) => {
        const token = sign(payload, this.accessSecret, { expiresIn: this.accessExpiry });
        return token;
    };

    generateTokenPair = (payload: BaseTokenPayload) => {
        const refreshToken = this.generateRefreshToken(payload);
        const accessToken = this.generateAccessToken(payload);

        return { accessToken, refreshToken };
    }
    
    verifyRefreshToken = (token: string) => {
        const decoded = verify(token, this.refreshSecret) as BaseTokenPayload;
        return decoded;
    };

    verifyAccessToken = (token: string) => {
        const decoded = verify(token, this.accessSecret) as BaseTokenPayload;
        return decoded;
    };
}