// Helper functions to hash and compare passwords.

import { hash, verify } from "@node-rs/argon2";

const options = {
    algorithm: 2, // Argon2ID enum value
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
};

export const hashPassword = async (password: string) => {
    const hashed = await hash(password, options);
    return hashed;
};

export const verifyPassword = async (hashed: string, plain: string) => {
    return await verify(hashed, plain);
}