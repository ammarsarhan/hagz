import { Request, Response } from "express";
import { checkIfPitchExists, getPitch } from "../repositories/pitchRepository";
import { createUserReservation, createOwnerReservation } from "../services/reservationService";

export async function handleCreateUserReservation(req: Request, res: Response) {
    try {
        const { pitchId, startDate, endDate } = req.body;
        const userId = req.user.id;

        if (!pitchId || !startDate || !endDate) {
            res.status(400).json({ success: false, message: "Please provide a valid pitch ID, start date, and end date." })
        };

        const pitch = await checkIfPitchExists(pitchId);
    
        if (!pitch) {
            res.status(404).json({ success: false, message: "Failed to create reservation. Could not find pitch with the specified ID." });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const reservation = await createUserReservation(pitchId, userId, start, end);

        if (!reservation) {
            res.status(400).json({ success: false, message: "Failed to create reservation." });
        }

        res.status(201).json({ success: true, message: "Reservation created successfully.", data: reservation });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleCreateOwnerReservation(req: Request, res: Response) {
    try {
        const { pitchId, name, phone, startDate, endDate } = req.body;

        if (!pitchId || !name || !phone || !startDate || !endDate) {
            res.status(400).json({ success: false, message: "Please provide a valid pitch ID, name, phone number, start date, and end date." });
        }

        const pitch = await checkIfPitchExists(pitchId);

        if (!pitch) {
            res.status(404).json({ success: false, message: "Failed to create reservation. Could not find pitch with the specified ID." });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const reservation = await createOwnerReservation(pitchId, name, phone, start, end);

        if (!reservation) {
            res.status(400).json({ success: false, message: "Failed to create reservation." });
        }

        res.status(201).json({ success: true, message: "Reservation created successfully.", data: reservation });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}