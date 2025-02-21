import { Request, Response } from "express";
import { getPitch } from "../repositories/pitchRepository";
import { fetchUserById } from "repositories/userRepository";
import { createReservation } from "../services/reservationService";

export async function handleCreateUserReservation(req: Request, res: Response) {
    try {
        const { pitchId, startDate, endDate } = req.body;
        const user = await fetchUserById(req.user.id);
        const pitch = await getPitch(pitchId);
    
        if (!pitch) {
            return res.status(404).json({ success: false, message: "Failed to create reservation. Could not find pitch with the specified ID." });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const reservation = await createReservation(pitch.id, user.name, user.phone, start, end, user.id);
        
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleCreateOwnerReservation(req: Request, res: Response) {
    res.send("Owner create reservation");
}