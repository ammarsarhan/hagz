import { checkIfUserExistsAlready, createUserWithCredentials } from '../repositories/userRepository';
import * as z from 'zod';

export async function signUpUserWithCredentials(name: string, email: string, password: string) {
    if (!name || !email || !password) {
        throw new Error('Insufficient parameters provided to create user.'); 
    }

    const schema = z.object({
        name: z.string(),
        email: z.string().email("Please provide a valid email address."),
        password: z.string().min(8, "Password must be at least 8 characters.").max(4096, "Password must be less than 100 characters.").regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).*$/, 
            "Must contain at least one uppercase letter, one lowercase letter, and one number."
        ),
    })

    const parsed = schema.safeParse({name, email, password});

    if (!parsed.success) {
        throw new Error(parsed.error.errors[0].message);
    }

    const exists = await checkIfUserExistsAlready(email);

    if (exists) {
        throw new Error("User with specified email already exists. Please use a different email address.");
    }

    await createUserWithCredentials(parsed.data.name, parsed.data.email, parsed.data.password);
}