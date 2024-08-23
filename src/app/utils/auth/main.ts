import HashPassword from "@/app/utils/auth/hash";

import { Role } from '@prisma/client';
import Prisma from "@/app/utils/db/prisma";

// Function to create a user with passed credentials
export async function createUserWithCredentials(firstName: string, lastName: string, email: string, password: string, phone?: string, image?: string, role?: Role) {
    // Check if the user already exists
    let user = await Prisma.user.findUnique({
        where: { email }
    })

    if (user) return new Response(JSON.stringify({ status: 409, message: "User already exists!" }), {
        headers: { "Content-Type": "application/json" },
    });;

    // If not register the user
    const hash = await HashPassword(password);

    try {
        user = await Prisma.user.create({
            data: {
                firstName,
                lastName : lastName,
                email: email,
                password: hash,
                phone: phone || null,
                image: image || null,
                role: role || Role.user
            }
        })
    } catch (error) {
        return new Response(JSON.stringify({ status: 400, message: `Failed to create user! Error: ${error}` }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ status: 200, message: "User created successfully!" }), {
        headers: { "Content-Type": "application/json" },
    });
}

// Function to authenticate user with passed credentials
export function authenticateWithCredentials(email: string, password: string) {
    
}