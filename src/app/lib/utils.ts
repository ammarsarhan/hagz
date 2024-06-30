import { hash } from "argon2"

export const hashPassword = async (password: string) => {
    return await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        hashLength: 32,
        parallelism: 1
    })
}