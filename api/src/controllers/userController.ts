import { Request, Response } from 'express';
import { fetchUserById } from '../repositories/userRepository';
import { maskEmail, maskPhone } from '../utils/mask';

export async function handleFetchUser(req: Request, res: Response) {
    try { 
        const id = req.user.id;

        if (!id) {
            throw new Error("Could not fetch user. Invalid access token provided.");
        }

        const user = await fetchUserById(id);
        
        res.status(200).json({ success: true, 
            data: {
                id: user.id,
                name: user.name,
                email: maskEmail(user.email),
                phone: maskPhone(user.phone),
                status: user.accountStatus
            } 
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}