import prisma from "@/shared/lib/prisma.js";
import type { SignUpPayloadType, UserResponseType } from "@/domains/auth/auth.validator.js";
import { hashPassword } from "@/shared/lib/hash.js";
import { ConflictError, ERROR_CODES } from "@/shared/lib/error.js";

export default class AuthService {
    createUser = async (payload: SignUpPayloadType): Promise<UserResponseType> => {
        const exists = await prisma.user.findUnique({ where: { phone: payload.phone }});
        if (exists) throw new ConflictError("A user with the specified phone number already exists.", ERROR_CODES.USER_PHONE_ALREADY_EXISTS)

        const hashed = await hashPassword(payload.password);
        
        const { user, preferences } = await prisma.$transaction(async (tx) => {
            // Create the actual user account and return the data we need for the AuthContext on the frontend.
            const user = await tx.user.create({
                data: {
                    ...payload,
                    password: hashed
                },
                include: {
                    pitchPermissions: true
                }
            });

            // Create userPreferences to store data about the display/action preferences.
            const preferences = await tx.userPreferences.create({
                data: { userId: user.id }
            });

            return { user, preferences };
        });

        // Parse into an object that can be used with the client's AuthContext or Mobile implementations.
        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email,
            status: user.status,
            isVerified: user.isVerified,
            preferences: {
                language: preferences.language,
                timezone: preferences.timezone,
                notifications: preferences.notifications,
                paymentMethod: preferences.paymentMethod
            },
            permissions: user.pitchPermissions.map(item => ({
                pitchId: item.pitchId,
                role: item.role,
                permissions: item.permissions
            }))
        };
    }
}