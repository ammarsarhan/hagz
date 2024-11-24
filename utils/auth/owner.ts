import Owner from "@/utils/types/owner";
import hashPassword from "@/utils/hash";
import prisma, { handlePrismaError } from "@/utils/db";
import { sign } from "jsonwebtoken";
import { z } from "zod";
import { isOwnerVerified, sendOwnerVerificationEmail } from "@/utils/auth/verify";

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
            message: "",
            status: 200
        };

    } catch (error) {
        return {
            message: handlePrismaError(error as Error),
            status: 400
        }
    }
    
}