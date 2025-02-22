import { hash } from "bcrypt";
import prisma from "../utils/db";

export async function createUserWithCredentials(name: string, email: string, phone: string, password: string) {
    try {
        const hashed = await hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name: name,
                email: email,
                phone: phone,
                password: hashed
            }
        });

        return user;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchUserByEmail(email: string) {
    try {
        const user = await prisma.user.findUnique({
            where: {
                email: email
            }
        })

        if (!user) {
            throw new Error("Invalid credentials provided. Please try again.")
        }

        return user;
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export async function fetchUserById(id: string) {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: id
            }
        })

        if (!user) {
            throw new Error("Invalid credentials provided. Please try again.")
        }

        return user;
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export async function fetchUserByPhone(phone: string) {
    try {
        const user = await prisma.user.findUnique({
            where: {
                phone: phone
            }
        })

        if (!user) {
            throw new Error("Invalid credentials provided. Please try again.")
        }

        return user;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function checkIfUserExistsAlready ({ email, phone, id }: { email?: string, phone?: string, id?: string }) {
    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email } : {},
                    phone ? { phone: phone } : {},
                    id ? { id: id } : {}
                ]
            }
        });

        if (user) {
            return true;
        }
        
        return false;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function checkIfUserVerifiedAlready (id: string) {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: id,
                accountStatus: "ACTIVE"
            }
        });

        if (user) {
            return true
        } else {
            return false
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function setUserVerificationToken(id: string, token: string) {
    try {
        await prisma.user.update({
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

export async function setUserAccountStatus(id: string) {
    try {
        await prisma.user.update({
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
