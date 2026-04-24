import z from "zod";
import type { Language, NotificationMethod, PaymentMethod, PermissionsRole, UserStatus } from "@/generated/prisma/enums.js";
import type { PitchPermissions, User, UserPreferences } from "@/generated/prisma/client.js";

// Fetch user by either phone or id.
export type FetchUserPayloadType = 
  | { type: "phone"; phone: string }
  | { type: "id"; id: string };

export type UserResponseType = {
    id: string,
    firstName: string,
    lastName: string,
    phone: string,
    email: string | null,
    status: UserStatus,
    isVerified: boolean,
    preferences: {
        language: Language,
        timezone: string,
        notifications: Array<NotificationMethod>,
        paymentMethod: PaymentMethod
    },
    permissions: Array<{
        pitchId: string,
        role: PermissionsRole,
        permissions: any // Todo: Modify this later to accept a standardized permissions object.
    }>
}

export type SignUpPayloadType = z.infer<typeof signUpSchema>

export const signUpSchema = z.object({
    firstName: z
        .string("Please enter a valid first name.")
        .min(2, "First name must be at least 2 characters long.")
        .max(100, "First name must be 100 characters long at most."),
    lastName: z
        .string("Please enter a valid last name.")
        .min(2, "Last name must be at least 2 characters long.")
        .max(100, "Last name must be 100 characters long at most."),
    phone: z
        .string("Phone number is required.")
        .regex(/^\+[1-9]\d{7,14}$/, "Phone number must include the international code and be in an acceptable format."),
    password: z
        .string("Password is required")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, "Password must be at least 8 characters long and include uppercase, lowercase, number, and special characters."),
});

export type SignInPayloadType = z.infer<typeof signInSchema>;

export const signInSchema = z.object({
    phone: z
        .string("Phone number is required.")
        .regex(/^\+[1-9]\d{7,14}$/, "Could not find user account with the specified credentials."),
    password: z
        .string("Password is required")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, "Could not find user account with the specified credentials."),
});

export const createUserResponse = (user: User, preferences: UserPreferences, permissions: Array<PitchPermissions>): UserResponseType => {
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
        permissions: permissions.map(item => ({
            pitchId: item.pitchId,
            role: item.role,
            permissions: item.permissions
        }))
    };
}
