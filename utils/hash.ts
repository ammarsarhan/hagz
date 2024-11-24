import bcrypt from 'bcrypt';

export default async function hashPassword(password: string) {
    try {
        const hash = await bcrypt.hash(password, 10);
        return hash;
    } catch (error) {
        console.error("An error has occurred while hashing password:", error);
        throw error;
    }
}