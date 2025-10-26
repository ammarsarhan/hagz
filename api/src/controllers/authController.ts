import { NextFunction, Request, Response } from "express";
import z from 'zod';
import jwt, { JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { compare } from "bcryptjs";

import prisma from "@/utils/prisma";
import { createManager, createOwner, createUser } from "@/model/userModel";
import { generateAccessToken, generateRefreshToken, generateVerificationToken, hashPassword } from "@/utils/token";
import { getResendLeft } from "@/utils/time";
import { resolveUserRole } from "@/utils/dashboard";

// Handle the creation and authentication of Credentials-Based accounts
export async function signUpWithCredentials(req: Request, res: Response, next: NextFunction) {
    const body = req.body;

    // Constants for this sign-up method.
    const provider = "EMAIL";
    const signInMethod = "PASSWORD";

    // Validation schema to check against once more on the backend along with the role ENUM added.
    const schema = z.object({
        firstName: z
            .string({ error: "Please enter a valid first name." })
            .min(2, { error: "First name must be at least 2 characters." })
            .max(100, { error: "First name must be at most 100 characters." }),
        lastName: z
            .string({ error: "Please enter a valid last name." })
            .min(2, { error: "Last name must be at least 2 characters." })
            .max(100, { error: "Last name must be at most 100 characters." }),
        email: z
            .email({ error: "Please enter a valid email address." }),
        phone: z
            .string({ error: "Please enter a valid phone number." })
            .optional()
            .refine(val => !val || val.length === 0 || (val.length >= 10 && val.length <= 15), {
                error: "Phone number must be between 10 and 15 characters if provided."
            }),
        password: z
            .string({ error: "Please enter a valid password." })
            .min(8, { error: "Password must be at least 8 characters." })
            .max(100, { error: "Password must be at most 100 characters." })
            .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/, { 
                error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character." 
            }),
        role: z.enum(["USER", "OWNER", "MANAGER"]),
    }, { error: "Expected a valid user object." })
    .superRefine((data, ctx) => {
        if (data.role === "MANAGER" && !req.body.token) {
            ctx.addIssue({
                code: "custom",
                message: "Token is required for managers.",
                path: ["token"]
            });
        };
    });

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    // Hash the password to ensure passwords are not stored as plaintext.
    const hash = await hashPassword(parsed.data.password);

    // Store the user within the database by using the userModel helper function to create all needed instances in one transaction.
    // createFn is a tertiary statement to help us select based on which role we want to create the user for.
    const createFn = 
        parsed.data.role === "USER" ? createUser : 
        parsed.data.role === "MANAGER" ? createManager : 
        createOwner;

    try {
        const user = await createFn({
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            phone: parsed.data.phone,
            password: hash,
            provider,
            signInMethod,
            token: req.body.token
        });

        const role = await resolveUserRole(user.id);
    
        const refreshToken = await generateRefreshToken(user.id, randomUUID());
        const accessToken = await generateAccessToken(user.id, randomUUID(), role, user.status);
    
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        return res.status(201).json({ message: "Created user account successfully!" });
    } catch (error: any) {
        return res.status(400).json({ message: error.message });
    }
};

export async function signInWithCredentials(req: Request, res: Response, next: NextFunction) {
    const body = req.body;

    // Constants for this sign-up method.
    const provider = "EMAIL";
    const signInMethod = "PASSWORD";

    const schema = z.object({
        email: z
            .email({ error: "Please enter a valid email address." }),
        password: z
            .string({ error: "Please enter a valid password." })
            .min(8, { error: "Password must be at least 8 characters." })
            .max(100, { error: "Password must be at most 100 characters." })
    }, { error: "Expected a valid credentials object." });

    const parsed = schema.safeParse(body);
    
    // If it doesn't fit the criteria then there is no possible way the user could have created the acccount using these credentials.
    // We can assume that safely and therefore better utilize the resources taken to verify false credentials.

    if (!parsed.success) {
        return res.status(401).json({ message: "Could not find user account with the specified credentials." });
    };

    // Continue our check by fetching the account with the providerId and email used to sign in and comparing passwords
    const account = await prisma.account.findFirst({
        where: {
            provider,
            signInMethod,
            user: { 
                status: {
                    notIn: ["SUSPENDED", "DELETED"]
                }
            },
            providerId: parsed.data.email
        },
        include: {
            user: {
                select: {
                    id: true,
                    verifiedMethods: true,
                    status: true
                }
            }
        }
    });

    if (!account || !account.password) {
        return res.status(401).json({ message: "Could not find user account with the specified credentials." });
    };
    
    const check = await compare(parsed.data.password, account?.password);
    
    if (!check) {
        return res.status(401).json({ message: "Could not find user account with the specified credentials." });
    };

    const role = await resolveUserRole(account.userId);

    const accessToken = await generateAccessToken(account.user.id, randomUUID(), role, account.user.status);
    const refreshToken = await generateRefreshToken(account.user.id, randomUUID());

    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Determine the redirect path based on user role to be used on the client-side.
    // Our base case is that we're dealing with a user, in that case we want them to go to the home page.
    let redirectPath = "/";
    
    switch (role) {
        case "USER":
            {
                if (account.user.verifiedMethods.length <= 0) {
                    redirectPath = "/auth/verify/send";
                };
            }
        case "MANAGER":
            {
                // Manager accounts will always be verified if they exist as they are created by token.
                redirectPath = "/dashboard";
            }
        case "OWNER":
            {
                // An unverified account will be redirected to /auth/verify/send
                redirectPath = "/auth/verify/send";

                // A verified owner account will go to /dashboard
                if (account.user.verifiedMethods.length > 0) {
                    redirectPath = "/dashboard";
                };
            }
    }

    return res.status(200).json({ message: "Logged user in successfully.", data: { redirectPath } });
}

// Handle the creation and authentication of Google OAuth2-Based accounts
export function signUpWithGoogle(req: Request, res: Response, next: NextFunction) {
    
}

export function signInWithGoogle(req: Request, res: Response, next: NextFunction) {

}

// Handle the creation and authentication of Meta OAuth2-Based accounts
export function signUpWithMeta(req: Request, res: Response, next: NextFunction) {

}

export function signInWithMeta(req: Request, res: Response, next: NextFunction) {
    
}

// User verification
export async function fetchVerificationData(req: Request, res: Response) {
    const id = req.user?.sub;

    try {
        const user = await prisma.user.findUnique({
            where: { 
                id
            },
            select: {
                firstName: true,
                status: true,
                verifiedMethods: true,
                verificationSentAt: true
            }
        });

        if (!user || user.status === "DELETED") {
            return res.status(404).json({ message: "Could not find user for the provided access token." })
        };
        
        if (user.status == "SUSPENDED") {
            return res.status(403).json({ message: "User does not have the required permissions to access this resource." })
        };

        if (user.status == "ACTIVE" || user.verifiedMethods.includes("EMAIL")) {
            return res.status(403).json({ message: `This user account has already been verified successfully. Welcome back, ${user.firstName}!` })
        };

        const resend = getResendLeft(user.verificationSentAt!);
        return res.status(200).json({ message: "Fetched user initial verification data successfully.", resend });
    } catch (error: any) {
        return res.status(500).json({ message: "An unexpected error on the server-side has occurred. Please try again later." });
    }
}

export async function issueVerificationToken(req: Request, res: Response) {
    // Get the user id appended to the request by the middleware
    const id = req.user?.sub;

    const user = await prisma.user.findUnique({ 
        where: { id }, 
        select: { id: true, verificationToken: true, verificationExpiresAt: true, verificationSentAt: true } 
    });

    if (!user) {
        return res.status(404).json({ message: "Could not find user with the specified ID. Failed to fetch user data." })
    }

    // In the case that the user has a verificationToken, they could either be:    
    // Resending the existing token if it is still valid
    const now = new Date();

    if (user.verificationToken && user.verificationExpiresAt && user.verificationExpiresAt > now && user.verificationSentAt) {
        // TODO: Create a Bull-MQ message to send the verification email
        const link = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${user.verificationToken}`;

        // Update verificationSentAt field
        try {
            const updated = await prisma.user.update({
                where: { id },
                data: { verificationSentAt: new Date() }
            });
            
            const resend = getResendLeft(updated.verificationSentAt!);
            return res.status(200).json({ message: "Verification link has not expired yet. Re-sent verification email with the same link successfully.", resend, link })
        } catch (error: any) {
            return res.status(500).json({ message: "An unexpected error on the server-side has occurred. Please try again later." });
        }
    };

    // Or the token has expired already,
    // in that case treat it like we're creating an initial new token

    // 1) Generate a new token
    // 2) Set the expiryDate to be 10 minutes later than now
    // 3) Update the user account
    // 4) Send the email

    const token = await generateVerificationToken(user.id, randomUUID());
    const link = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${token}`;
    const expiryDate = new Date(Date.now() + 10 * 60 * 1000); // now + 10 minutes

    try {
        const updated = await prisma.user.update({
            where: { id },
            data: {
                verificationToken: token,
                verificationExpiresAt: expiryDate,
                verificationSentAt: new Date()
            }
        });

        // TODO: Create a Bull-MQ message to send the verification email
    
        // Get the time left/cooldown
        const resend = getResendLeft(updated.verificationSentAt!);
        return res.status(200).json({ message: "Created and issued new verification link successfully. Please check your email for the verification link.", resend, link });
    } catch (error: any) {
        return res.status(500).json({ message: "An unexpected error on the server-side has occurred. Please try again later." });
    };
};

export async function verifyWithEmail(req: Request, res: Response, next: NextFunction) {
    const id = req.user?.sub;
    const token = req.body.token;

    if (!token) {
        return res.status(400).json({
            title: "Missing Verification Token",
            message: "Verification token has not been provided. Please provide a valid verification token."
        });
    };

    try {
        const user = await prisma.user.findUnique({
            where: { id, status: { notIn: ["DELETED", "SUSPENDED"] } },
            select: { verificationToken: true, verificationExpiresAt: true, status: true }
        });

        // User not found or deleted
        if (!user) {
            return res.status(404).json({
                title: "User Not Found",
                message: "Could not find user with the specified ID. Failed to fetch user data."
            });
        }

        // Already active
        if (user.status === "ACTIVE") {
            return res.status(200).json({
                title: "Already Verified",
                message: "User account is already active and does not require email verification. Welcome to Hagz!"
            });
        };

        // Token expired
        const now = new Date();

        if (user.verificationExpiresAt && user.verificationExpiresAt < now) {
            return res.status(400).json({
                title: "Token Expired",
                message: "Verification token has already expired. Please request a new verification email."
            });
        }

        // Token mismatch
        if (user.verificationToken !== token) {
            return res.status(400).json({
                title: "Invalid Token",
                message: "Invalid verification token provided. Please use the latest verification link sent."
            });
        }
    } catch (error: any) {
        return res.status(500).json({
            title: "Server Error",
            message: "An unexpected error on the server-side has occurred. Please try again later."
        });
    }

    // Verify against JWT secret
    const decoded = jwt.verify(token, process.env.VERIFICATION_TOKEN_SECRET!) as JwtPayload;
    const targetId = decoded.sub;

    if (!targetId || targetId != id) {
        return res.status(400).json({
            title: "Verification Failed",
            message: "Invalid verification token provided. Please use the verification link sent to your email."
        });
    }

    try {
        await prisma.user.update({
            where: { id },
            data: {
                status: "ACTIVE",
                verifiedMethods: { push: "EMAIL" },
                verificationToken: null,
                verificationExpiresAt: null,
                verificationSentAt: null
            }
        });

        return res.status(200).json({
            title: "Verification Successful",
            message: "User account has been verified successfully. Welcome to Hagz! You can now safely close this tab."
        });
    } catch (error: any) {
        return res.status(500).json({
            title: "Server Error",
            message: "An unexpected error on the server-side has occurred. Please try again later."
        });
    }
}

export async function refreshTokens(req: Request, res: Response, next: NextFunction) {
    // Get the refresh token from the cookies and ensure their existence.
    const token = req.cookies.refreshToken;
    const isServer = req.headers["x-ssr"] === "true";

    if (!token) {
        return res.status(400).json({ message: "Refresh token has not been provided. Can not create new tokens for this user. Please redirect to sign in page." });
    };

    // Validate the refresh token and make sure that it is still valid and has not expired.
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as JwtPayload;
    const id = decoded.sub;

    if (!id) {
        return res.status(401).json({ message: "Invalid refreshToken provided. Token failed verification process. Please sign in and try again." });
    };

    const user = await prisma.user.findUnique({ 
        where: { 
            id,
            status: { notIn: ["DELETED", "SUSPENDED"] },
        }, 
        select: { 
            id: true,
            status: true
        } 
    });

    // Check if the user has the permissions required to generate a new access token.
    if (!user) {
        return res.status(404).json({ message: "Could not find user with the specified ID. Failed to fetch user data."})
    };

    // Generate a fresh access token and append it to the cookies as an http-only cookie.
    const role = await resolveUserRole(id);
    const accessToken = await generateAccessToken(user.id, randomUUID(), role, user.status);

    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    if (isServer) {
        return res.status(200).json({ message: "Created a new access token for the specified user successfully.", accessToken })
    };

    return res.status(200).json({ message: "Created a new access token for the specified user successfully." });
}
