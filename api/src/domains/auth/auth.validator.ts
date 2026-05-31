import z from "zod";
import type { Language, NotificationChannel, PaymentMethod, StaffRole, UserStatus } from "@/generated/prisma/enums.js";
import type { Staff, User, UserPreferences } from "@/generated/prisma/client.js";
import type { Permissions } from "@/shared/types/staff.js";

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
        notifications: Array<NotificationChannel>,
        paymentMethod: PaymentMethod
    },
    pitches: Array<{
        pitchId: string,
        role: StaffRole,
        permissions: Permissions
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
        .regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in a valid format."),
    password: z
        .string("Password is required.")
        .min(2, "Password is required."),
});

export const createUserResponse = (user: User, preferences: UserPreferences, pitches: Array<Staff>): UserResponseType => {
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
        pitches: pitches.map(item => ({
            pitchId: item.pitchId,
            role: item.role,
            permissions: item.permissions as Permissions
        }))
    };
}
