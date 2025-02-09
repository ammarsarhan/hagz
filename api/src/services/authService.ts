import * as z from 'zod';
import { compare } from 'bcrypt';
import { generateAccessToken, generateRefreshToken, generateVerificationToken, TokenPayloadType } from '../utils/token';
import { checkIfUserExistsAlready, checkIfUserVerifiedAlready, createUserWithCredentials, fetchUserByEmail, setUserAccountStatus, setUserVerificationToken } from '../repositories/userRepository';
import { sendUserVerificationEmail } from './mailService';
import { verify } from 'jsonwebtoken';

export async function signInUserWithCredentials(email: string, password: string) {
    if (!email || !password) {
        throw new Error('Insufficient parameters provided to sign in user.'); 
    }

    const user = await fetchUserByEmail(email);
    const match = await compare(password, user.password);

    if (!match) {
        throw new Error('Invalid credentials provided. Please try again.');
    }

    const accessToken = generateAccessToken({id: user.id});
    const refreshToken = generateRefreshToken({id: user.id});
    
    return {accessToken, refreshToken};
}

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

    const user = await createUserWithCredentials(parsed.data.name, parsed.data.email, parsed.data.password);
    await handleSendUserVerification(user.email);
}

export async function handleSendUserVerification(email: string) {
    const schema = z.object({
        email: z.string({ message: "Insufficient parameters provided. Please provide a valid email address." }).email("Insufficient parameters provided. Please provide a valid email address."),
    })

    const parse = schema.safeParse({ email });

    if (parse.error) {
        throw new Error(parse.error.errors[0].message); 
    }
    
    const user = await fetchUserByEmail(email);

    const verificationToken = generateVerificationToken({id: user.id});
    await setUserVerificationToken(user.id, verificationToken);

    const link = `http://localhost:3000/api/auth/user/verify?token=${verificationToken}`;
    console.log(link);
    await sendUserVerificationEmail(email, link);
}

export async function verifyUserByToken(token: string) {
    verify(token, process.env.VERIFICATION_SECRET_KEY || "", async (error: any, user: any) => {
        if (error) {
            throw new Error("Invalid verification token provided.")
        }

        const targetId = user.id;
        const match = await checkIfUserVerifiedAlready(targetId);
        
        if (match) {
            throw new Error("Specified user account has already been verified.")
        }

        await setUserAccountStatus(targetId);
    });
}