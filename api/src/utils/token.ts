import { hash } from "bcryptjs";
import { sign } from 'jsonwebtoken';
import { UserStatus } from "generated/prisma";
import { UserRole } from "@/utils/dashboard";
import { randomBytes } from "crypto";

const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
const accessSecret = process.env.ACCESS_TOKEN_SECRET;
const verificationSecret = process.env.VERIFICATION_TOKEN_SECRET;
const invitationSecret = process.env.INVITATION_TOKEN_SECRET;

export interface AccessTokenPayload {
    sub: string, 
    jti: string, 
    role: UserRole, 
    status: UserStatus
}

export async function hashPassword(plain: string): Promise<string> {
    const hashed = await hash(plain, 10);
    return hashed;
}

export async function generateRefreshToken(sub: string, jti: string) {    
    if (!refreshSecret) {
        throw new Error("Token secret is not set in the environment variables.");
    };

    const payload = { sub, jti };
    const token = sign(payload, refreshSecret, { expiresIn: '7d' });

    return token;
}

export async function generateAccessToken(sub: string, jti: string, role: UserRole, status: UserStatus) {
    if (!accessSecret) {
        throw new Error("Token secret is not set in the environment variables.");
    };

    const payload = { sub, jti, role, status } as AccessTokenPayload;
    const token = sign(payload, accessSecret, { expiresIn: '15m' });

    return token;
}

export async function generateVerificationToken(sub: string, jti: string) {
    if (!verificationSecret) {
        throw new Error("Token secret is not set in the environment variables.");
    }

    const payload = { sub, jti };
    const token = sign(payload, verificationSecret, { expiresIn: '10m' });

    return token;
}

export async function generateInvitationToken(sub: string, jti: string, expiresIn: "1" | "7" | "30") {
    if (!invitationSecret) {
        throw new Error("Token secret is not set in the environment variables.");
    };

    const payload = { sub, jti };
    const token = sign(payload, invitationSecret, { expiresIn: `${expiresIn}d` });

    return token;
};

function toBase36(buf: Buffer) {
    // take hex and convert to base36 string
    return BigInt('0x' + buf.toString('hex')).toString(36).toUpperCase();
};

export function generateReferenceId(prefix = "HZ") {
    const date = new Date();
    const datePart = date.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

    // Generate 6-7 char random part reliably
    const rnd = toBase36(randomBytes(5)).slice(0, 6).padStart(6, "0"); // stable length

    return `${prefix}-${datePart}-${rnd}`;
}