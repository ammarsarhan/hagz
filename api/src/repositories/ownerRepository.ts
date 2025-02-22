import { hash } from "bcrypt";
import prisma from "../utils/db";

export async function createOwnerWithCredentials(name: string, email: string, phone: string, password: string) {
    try {
        const hashed = await hash(password, 10);

        const owner = await prisma.owner.create({
            data: {
                name: name,
                email: email,
                phone: phone,
                password: hashed
            }
        });

        return owner;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function checkIfOwnerExistsAlready ({ email, phone, id }: { email?: string, phone?: string, id?: string }) {
    try {
        const owner = await prisma.owner.findFirst({
            where: {
                OR: [
                    email ? { email: email } : {},
                    phone ? { phone: phone } : {},
                    id ? { id: id } : {}
                ]
            }
        });

        if (owner) {
            return true;
        }
        
        return false;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchOwnerByEmail(email: string) {
    try {
        const owner = await prisma.owner.findUnique({
            where: {
                email: email
            }
        })

        if (!owner) {
            throw new Error("Invalid credentials provided. Please try again.")
        }

        return owner;
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export async function fetchOwnerById(id: string) {
    try {
        const owner = await prisma.owner.findUnique({
            where: {
                id: id
            }
        })

        if (!owner) {
            throw new Error("Invalid credentials provided. Please try again.")
        }

        return owner;
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export async function checkIfOwnerVerifiedAlready (id: string) {
    try {
        const owner = await prisma.owner.findUnique({
            where: {
                id: id,
                accountStatus: "ACTIVE"
            }
        });

        if (owner) {
            return true;
        } else {
            return false;
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function setOwnerVerificationToken(id: string, token: string) {
    try {
        await prisma.owner.update({
            where: {
                id: id
            },
            data: {
                verificationToken: token
            }
        })
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function setOwnerAccountStatus(id: string) {
    try {
        await prisma.owner.update({
            where: {
                id: id
            },
            data: {
                accountStatus: "ACTIVE"
            }
        })
    } catch (error: any) {
        throw new Error(error.message);
    }
}
