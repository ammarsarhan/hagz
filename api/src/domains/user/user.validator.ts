import z from 'zod';

export type CreateUserPayload = z.infer<typeof createUserSchema>;

export const createUserSchema = z.object({
    firstName: z
        .string("First name is required.")
        .min(2, "First name must at least be 2 characters long.")
        .max(30, "First name must be 30 characters long at most."),
    lastName: z
        .string("Last name is required.")
        .min(2, "Last name must at least be 2 characters long.")
        .max(30, "Last name must be 30 characters long at most."),
    phone: z
        .string("Phone is required.")
        .regex(/^\d{4}-\d{3}-\d{4}$/, "Phone must be in the required format."),
    password: z
        .string("Password is required")
        .min(8, "Password must be at least 8 characters long.")
        .max(50, "Password must be 50 characters long at most.")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Password must contain at least one uppercase letter, one lowercase letter, and one number."),
    role: z.enum(["USER", "ADMIN"])
});

export type SignInPayload = z.infer<typeof signInSchema>;

export const signInSchema = z.object({
    phone: z
        .string("Phone is required.")
        .regex(/^\d{4}-\d{3}-\d{4}$/, "Phone number must be in the required format."),
    password: z
        .string("Password is required")
        .min(8, "Could not find an account with the specified credentials.")
        .max(50, "Could not find an account with the specified credentials.")
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Could not find an account with the specified credentials."),
});

export interface UserMeta { ipAddress?: string, userAgent?: string };
