import * as z from 'zod';
import { compare } from 'bcrypt';
import { verify } from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, generateVerificationToken } from '../utils/token';
import { sendOwnerVerificationEmail, sendUserVerificationEmail } from './mailService';
import { 
    checkIfUserExistsAlready, 
    checkIfUserVerifiedAlready, 
    createUserWithCredentials, 
    fetchUserByEmail, 
    setUserAccountStatus, 
    setUserVerificationToken 
} from '../repositories/userRepository';
import { 
    checkIfOwnerExistsAlready, 
    checkIfOwnerVerifiedAlready, 
    createOwnerWithCredentials, 
    fetchOwnerByEmail, 
    setOwnerAccountStatus, 
    setOwnerVerificationToken 
} from '../repositories/ownerRepository';

async function checkIfAccountExists(email: string, phone: string) {
    const userMatch = await checkIfUserExistsAlready({ email, phone });

    if (userMatch) {
        throw new Error("Owner with specified email or phone already exists. Please use a different email address or phone number.");
    }

    const ownerMatch = await checkIfOwnerExistsAlready({ email, phone });

    if (ownerMatch) {
        throw new Error("Owner with specified email or phone already exists. Please use a different email address or phone number.");
    }
}

export async function signInUserWithCredentials(email: string, password: string) {
    const user = await fetchUserByEmail(email);
    const match = await compare(password, user.password);

    if (!match) {
        throw new Error('Invalid credentials provided. Please try again.');
    }

    const accessToken = generateAccessToken({id: user.id, type: "User"});
    const refreshToken = generateRefreshToken({id: user.id, type: "User"});
    
    return { accessToken, refreshToken };
}

export async function signUpUserWithCredentials(name: string, email: string, phone: string, password: string) {
    const schema = z.object({
        name: z.string(),
        email: z.string().email("Please provide a valid email address."),
        phone: z.string().regex(/^\d{4}-\d{3}-\d{4}$/, "Please provide a valid phone number."),
        password: z.string().nonempty("Please provide a valid password.").min(8, "Password must be at least 8 characters.").max(255, "Password must be less than 255 characters.").regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, { message: "Password must contain at least one uppercase letter, one number, and one special character." }),
    });

    const parsed = schema.safeParse({name, email, phone, password});

    if (!parsed.success) {
        throw new Error(parsed.error.errors[0].message);
    }

    await checkIfAccountExists(email, phone);

    const user = await createUserWithCredentials(parsed.data.name, parsed.data.email, parsed.data.phone, parsed.data.password);
    await handleSendUserVerification(user.email);
}

export async function handleSendUserVerification(email: string) {
    const schema = z.string({ message: "Insufficient parameters provided. Please provide a valid email address." }).email("Insufficient parameters provided. Please provide a valid email address.")

    const parse = schema.safeParse(email);

    if (parse.error) {
        throw new Error(parse.error.errors[0].message); 
    }

    const user = await fetchUserByEmail(parse.data);

    if (user.accountStatus != "UNVERIFIED") {
        throw new Error("Could not send verification email. Specified user account is no longer unverified.");
    }

    const verificationToken = generateVerificationToken({id: user.id, type: "User"});
    await setUserVerificationToken(user.id, verificationToken);

    const link = `http://localhost:3000/api/auth/user/verify?token=${verificationToken}`;
    await sendUserVerificationEmail(email, link);
}

export async function verifyUserByToken(token: string) {
    try {
        const decoded = verify(token, process.env.VERIFICATION_SECRET_KEY || "");

        if (typeof decoded == "object") {
            const target = decoded.id;
            const match = await checkIfUserVerifiedAlready(target);

            if (match) {
                throw new Error("Specified user account has already been verified.");
            }

            await setUserAccountStatus(target);
        } else {
            throw new Error("Invalid verification token provided.");
        }
    } catch (error: any) {
        throw new Error(`Could not verify user. ${error.message}`);
    }
}

export async function handleSendOwnerVerification(email: string) {
    const schema = z.object({
        email: z.string({ message: "Insufficient parameters provided. Please provide a valid email address." }).email("Insufficient parameters provided. Please provide a valid email address."),
    })

    const parse = schema.safeParse({ email });

    if (parse.error) {
        throw new Error(parse.error.errors[0].message); 
    }
    
    const owner = await fetchOwnerByEmail(email);

    if (owner.accountStatus === "ACTIVE") {
        throw new Error("Could not send verification email. Specified owner account has already been verified.");
    }
    
    const verificationToken = generateVerificationToken({id: owner.id, type: "Owner"});
    await setOwnerVerificationToken(owner.id, verificationToken);

    const link = `http://localhost:3000/api/auth/owner/verify?token=${verificationToken}`;
    await sendOwnerVerificationEmail(email, link);
}

export async function signUpOwnerWithCredentials(name: string, email: string, phone: string, password: string) {
    try {
        const schema = z.object({
            name: z.string(),
            email: z.string().email("Please provide a valid email address."),
            phone: z.string().regex(/^\d{4}-\d{3}-\d{4}$/, "Please provide a valid phone number."),
            password: z.string().nonempty("Please provide a valid password.").min(8, "Password must be at least 8 characters.").max(255, "Password must be less than 255 characters.").regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, { message: "Password must contain at least one uppercase letter, one number, and one special character." })
        })
    
        const parsed = schema.safeParse({name, email, phone, password});
    
        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }
    
        await checkIfAccountExists(email, phone);
    
        const owner = await createOwnerWithCredentials(parsed.data.name, parsed.data.email, parsed.data.phone, parsed.data.password);
        await handleSendOwnerVerification(owner.email);
    } catch (error: any) {
        throw new Error(`Could not create new owner. ${error.message}`);
    }
}

export async function signInOwnerWithCredentials(email: string, password: string) {
    const owner = await fetchOwnerByEmail(email);
    const match = await compare(password, owner.password);

    if (!match) {
        throw new Error('Invalid credentials provided. Please try again.');
    }

    const accessToken = generateAccessToken({id: owner.id, type: "Owner"});
    const refreshToken = generateRefreshToken({id: owner.id, type: "Owner"});
    
    return { accessToken, refreshToken };
}

export async function verifyOwnerByToken(token: string) {
    try {
        const decoded = verify(token, process.env.VERIFICATION_SECRET_KEY || "");

        if (typeof decoded == "object") {
            const target = decoded.id;
            const match = await checkIfOwnerVerifiedAlready(target);

            if (match) {
                throw new Error("Specified owner account has already been verified.");
            }

            await setOwnerAccountStatus(target);
        } else {
            throw new Error("Invalid verification token provided.");
        }

    } catch (error: any) {
        throw new Error(`Could not verify owner. ${error.message}`);
    }
}