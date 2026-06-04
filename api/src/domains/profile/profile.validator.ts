import { Language, NotificationChannel, PaymentMethod } from "@/generated/prisma/enums.js";
import z from "zod";

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
});
