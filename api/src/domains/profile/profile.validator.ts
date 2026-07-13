import { GroundSize, GroundSport, Language, NotificationChannel, PaymentMethod, UserRole } from "@/generated/prisma/enums.js";
import z from "zod";

// Todo: Check where we're using this function in this file.
const trim = 
    (error: string) => z
        .string(error)
        .transform(s => s.trim());

export type UpdateUserProfilePayloadType = z.infer<typeof updateUserProfileSchema>;

export const updateUserProfileSchema = z.object({
    firstName: z
        .string("Please enter a valid first name.")
        .min(2, "First name must be at least 2 characters long.")
        .max(100, "First name must be 100 characters long at most.")
        .optional(),
    lastName: z
        .string("Please enter a valid last name.")
        .min(2, "Last name must be at least 2 characters long.")
        .max(100, "Last name must be 100 characters long at most.")
        .optional(),
    phone: z
        .string("Phone number is required.")
        .regex(/^\+[1-9]\d{7,14}$/, "Phone number must include the international code and be in an acceptable format.")
        .optional(),
    email: z
        .email("Email must be a valid email address.")
        .optional(),
});

export type CreateAvatarPresignLinkPayloadType = z.infer<typeof createAvatarPresignLinkSchema>;

export const createAvatarPresignLinkSchema = z.object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"], "Please select a valid image type."),
    size: z.number().positive().max(5 * 1024 * 1024, "Image must be less than 5 MBs."),
})

export type UpdateUserPreferencesPayloadType = z.infer<typeof updateUserPreferencesSchema>;

export const updateUserPreferencesSchema = z.object({
    language: z
        .enum(Object.values(Language) as [Language, ...Language[]], "Please select a valid language.")
        .optional(),
    notifications: z
        .array(
            z.enum(Object.values(NotificationChannel) as [NotificationChannel, ...NotificationChannel[]], "Please select a valid notification channel.")
        )
        .optional(),
    paymentMethod: z
        .enum(Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]], "Please select a valid payment method.")
        .optional(),
    timezone: z
        .string("Please enter a valid timezone.")
        .optional(),
    areaId: z
        .cuid("Please select a valid area.")
        .optional(),
    latitude: z
        .number("Latitude must be a valid number.")
        .min(-90, "Latitude must be a valid number between -90 and 90.")
        .max(90, "Latitude must be a valid number between -90 and 90.")
        .optional(),
    longitude: z.
        number("Longitude must be a valid number.")
        .min(-180, "Longitude must be a valid number between -180 and 180.")
        .max(180, "Longitude must be a valid number between -180 and 180.")
        .optional(),
    sports: z
        .array(z.enum(Object.values(GroundSport) as [GroundSport, ...GroundSport[]]), "Please select one of the default provided sports.")
        .optional(),
    sizes: z
        .array(z.enum(Object.values(GroundSize) as [GroundSize, ...GroundSize[]]), "Please select one of the default provided ground sizes.")
        .optional()
});

export const transferAccountSchema = z.object({
    role: z.enum(Object.values(UserRole) as [UserRole, ...UserRole[]], "Please select a valid role.")
});

