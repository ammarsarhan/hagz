import { sign } from "jsonwebtoken";

export interface TokenPayloadType {
    id: string;
}

const verificationKey = process.env.VERIFICATION_SECRET_KEY || "";
const accessKey = process.env.ACCESS_SECRET_KEY || "";
const refreshKey = process.env.REFRESH_SECRET_KEY || "";

export function generateVerificationToken(data: TokenPayloadType) {
    const token = sign(data, verificationKey, {expiresIn: "15m"});
    return token;
}

export function generateAccessToken(data: TokenPayloadType) {
    const token = sign(data, accessKey, {expiresIn: "30m"});
    return token;
}

export function generateRefreshToken(data: TokenPayloadType) {
    const token = sign(data, refreshKey, {expiresIn: "7d"});
    return token;
}