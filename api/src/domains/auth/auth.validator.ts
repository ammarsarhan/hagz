import z from "zod";

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
