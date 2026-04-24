import z from "zod";
import type { Language, NotificationMethod, PaymentMethod, PermissionsRole, UserStatus } from "@/generated/prisma/enums.js";

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
        .min(10, "Phone number must be at least 10 characters long.")
        .max(20, "Phone number may not be longer than 20 characters."),
    password: z
        .string("Password is required")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, "Password must be at least 8 characters long and include uppercase, lowercase, number, and special characters."),
});
