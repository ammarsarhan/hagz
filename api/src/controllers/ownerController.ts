import { Request, Response } from 'express';
import { fetchOwnerById } from '../repositories/ownerRepository';
import { maskEmail, maskPhone } from '../utils/mask';

export async function handleFetchOwner(req: Request, res: Response) {
    try { 
        const id = req.user.id;

        if (!id) {
            throw new Error("Could not fetch user. Invalid access token provided.");
        }

        const owner = await fetchOwnerById(id);
        
        res.status(200).json({ success: true, 
            data: {
                id: owner.id,
                name: owner.name,
                email: maskEmail(owner.email),
                phone: maskPhone(owner.phone),
                status: owner.accountStatus
            } 
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}