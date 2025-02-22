import { JwtPayload, sign } from "jsonwebtoken";

export interface TokenDataType {
    id: string;
    type: "User" | "Owner" | "Reservation";
}

export type TokenPayloadType = TokenDataType & JwtPayload;

const reservationKey = process.env.RESERVATION_SECRET_KEY || "";
const verificationKey = process.env.VERIFICATION_SECRET_KEY || "";
const accessKey = process.env.ACCESS_SECRET_KEY || "";
const refreshKey = process.env.REFRESH_SECRET_KEY || "";

export function generateReservationToken(data: TokenDataType) {
    const token = sign(data, reservationKey, {expiresIn: "15m"});
    return token;
}

export function generateVerificationToken(data: TokenDataType) {
    const token = sign(data, verificationKey, {expiresIn: "15m"});
    return token;
}

export function generateAccessToken(data: TokenDataType) {
    const token = sign(data, accessKey, {expiresIn: "30m"});
    return token;
}

export function generateRefreshToken(data: TokenDataType) {
    const token = sign(data, refreshKey, {expiresIn: "7d"});
    return token;
}