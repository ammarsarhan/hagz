import Owner from "@/utils/types/owner";
import hashPassword, { comparePassword } from "@/utils/hash";
import prisma, { handlePrismaError } from "@/utils/db";
import { sign } from "jsonwebtoken";
import { z } from "zod";
import { sendOwnerVerificationEmail } from "@/utils/auth/verify";

const ownerAuthSchema = z.object({
    email: z.string().email({message: "Please provide a valid email address."}),
    password: z.string().min(8, {message: "Please provide a valid password."}),
})

const ownerFieldSchema = z.object({
    firstName: z.string().min(1, {message: "First name field must not be empty"}).max(50, {message: "First name must contain 50 characters at most"}).regex(/^[A-Za-z]+$/, {
        message: "First name must contain only letters",
}),
    lastName: z.string().min(1, {message: "Last name field must not be empty"}).max(50, {message: "Last name must contain 50 characters at most"}).regex(/^[A-Za-z]+$/, {
        message: "Last name must contain only letters",
    }),
    email: z.string().email({message: "Please provide a valid email address"}),
    phone: z.string().regex(/^\d{4}-\d{3}-\d{4}$/, {
        message: "Phone number must match the format: 0000-000-0000",
    }),
    preferences: z.union([z.literal("Email"), z.literal("SMS"), z.literal("Phone")], {message: "Please select a valid preference"}),
    location: z.object({
        building: z.string().max(50, {message: "Building field must contain 50 characters at most"}).optional(),
        street: z.string().min(1, {message: "Street field must not be empty"}).max(50, {message: "Street field must contain 50 characters at most"}),
        address: z.string().min(1, {message: "Address field must not be empty"}).max(50, {message: "Address field must contain 50 characters at most"}),
        city: z.string().min(1, {message: "City field must not be empty"}).max(50, {message: "City field must contain 50 characters at most"}),
        governorate: z.string().min(1, {message: "Governorate field must not be empty"}).max(25, {message: "Governorate field must contain 25 characters at most"}),
    }),
    password: z.string().min(8, {message: "Password must contain at least 8 characters"}).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
        message: "Password must contain both letters and numbers",
    }),
    company: z.string().max(50, {message: "Company must contain 50 characters at most"}).optional(),
    profilePicture: z.string().optional()
})

export async function checkIfOwnerExists(address?: string, number?: string) {
    if (!address && !number) {
        return {
            exists: false,
            message: "Either address (email) or number (phone) is required."
        };
    };

    const email = address && await prisma.owner.findUnique({
        where: {
            email: address
        }
    });

    const phone = number && await prisma.owner.findUnique({
        where: {
            phone: number
        }
    });

    if (email || phone) {
        return {
            exists: true,
            email: email ? true : false,
            phone: phone ? true : false,
        };
    };
    
    return {
        exists: false
    };
}

export async function createOwnerWithCredentials(fields: Partial<Owner> & Pick<Owner, 
    "firstName" | 
    "lastName" | 
    "email" | 
    "phone" | 
    "preferences" | 
    "location" |
    "password">) 
{
    const validation = ownerFieldSchema.safeParse(fields);
    
    if (validation.error) {
        return {
            message: validation.error.errors[0].message,
            status: 400
        };
    }

    const owner = await checkIfOwnerExists(fields.email, fields.phone);

    if (owner.exists) {
        return {
            message: "Account with same email or phone number already in use.",
            status: 403
        };
    }

    try {
        let hashed = await hashPassword(fields.password);
        const owner = await prisma.owner.create({
            data: {
                firstName: fields.firstName,
                lastName: fields.lastName,
                email: fields.email,
                phone: fields.phone,
                preferences: fields.preferences,
                password: hashed,
                company: fields.company ? fields.company : null,
                profilePicture: fields.profilePicture ? fields.profilePicture : null,
                pitches: {
                    create: []
                },
                activePaymentMethod: {},
                paymentMethods: [{}],
                paymentHistory: {
                    create: []
                },
                location: {
                    ...fields.location
                },
                phoneStatus: "Inactive",
                emailStatus: "Inactive",
            }
        });

        sendOwnerVerificationEmail(owner.firstName, owner.email);
        
        return {
            message: "Created owner account successfully!",
            status: 200
        };

    } catch (error) {
        return {
            message: handlePrismaError(error as Error),
            status: 400
        }
    }
    
}

export function generateAccessToken (name: string, email: string, id: string) {
    if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new Error("Invalid email: Please provide a valid email address.");
    }
      
    const [localPart, domain] = email.split("@");
    const firstLetter = localPart[0];
    const maskedEmail = `${firstLetter}****@${domain}`;

    const token = sign({name, email: maskedEmail, id, role: "Owner"}, process.env.JWT_SECRET as string, {expiresIn: "15m"});
    return token;
}

export function generateRefreshToken (id: string) {
    const token = sign({id}, process.env.JWT_SECRET as string, {expiresIn: "30d"});
    return token;
}

export async function authenticateOwnerWithCredentials (email: string, password: string) {
    const validation = ownerAuthSchema.safeParse({email, password});
    if (!validation.success) {
        return {
            message: validation.error.issues[0].message,
            status: 400
        }
    }

    try {
        const owner = await prisma.owner.findUnique({
            where: {
                email: email
            }
        })

        if (!owner) {
            return {
                message: "Could not find account with specified credentials. Please try again.",
                status: 404
            }
        }

        if (owner.emailStatus == "Inactive") {
            return {
                message: "Owner account has not been verified. Please check your email for a verification link.",
                status: 403
            }
        }

        if (owner.emailStatus == "Suspended") {
            return {
                message: "Owner account has been suspended. Please contact customer support for more information.",
                status: 403
            }
        }
        
        const authenticate = await comparePassword(password, owner.password);
        if (authenticate != true) {
            return {
                message: "Could not find account with specified credentials. Please try again.",
                status: 404
            }
        }

        const accessToken = generateAccessToken(owner.firstName, owner.email, owner.id);
        const refreshToken = generateRefreshToken(owner.id);

        const ownerToken = await prisma.ownerToken.create({
            data: {
                ownerId: owner.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });

        if (!ownerToken) {
            return {
                message: "An error occurred while generating tokens. Please try again.",
                status: 500
            }
        }

        console.log(ownerToken);

        return {
            message: "Authenticated user successfully!",
            accessToken: accessToken,
            refreshToken: refreshToken,
            status: 200
        }
    } catch (error) {
        return {
            message: handlePrismaError(error as Error),
            status: 400
        }
    }
}