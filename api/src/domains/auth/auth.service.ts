import prisma from "@/shared/lib/prisma.js";
import type { SignUpPayloadType } from "@/domains/auth/auth.validator.js";
import { hashPassword } from "@/shared/lib/hash.js";
import { ConflictError, ERROR_CODES } from "@/shared/lib/error.js";

export default class AuthService {
    createUser = async (payload: SignUpPayloadType) => {
        const exists = await prisma.user.findUnique({ where: { phone: payload.phone }});
        if (exists) throw new ConflictError("A user with the specified phone number already exists.", ERROR_CODES.USER_PHONE_ALREADY_EXISTS)

        const hashed = await hashPassword(payload.password);
        
        const user = await prisma.user.create({
            data: {
                ...payload,
                password: hashed
            }
        });

        return user;
    }
}