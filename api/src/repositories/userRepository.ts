import prisma from "../utils/db";
import { hash } from "bcrypt";

export async function createUserWithCredentials(name: string, email: string, password: string) {
    try {
        const hashed = await hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashed
            }
        });

        return user;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function checkIfUserExistsAlready (email: string) {
    try {
        const user = await prisma.user.findUnique({
            where: {
                email: email
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