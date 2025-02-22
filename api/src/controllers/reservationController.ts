import { Request, Response } from "express";

import { checkIfPitchExists, getPitch } from "../repositories/pitchRepository";
import { 
    createUserReservation, 
    createOwnerReservation, 
    fetchReservation, 
    fetchAllReservations, 
    fetchScheduledReservations,
    fetchDoneReservations
 } from "../services/reservationService";

export async function handleCreateUserReservation(req: Request, res: Response) {
    try {
        const { pitchId, startDate, endDate } = req.body;
        const userId = req.user.id;

        if (!pitchId || !startDate || !endDate) {
            res.status(400).json({ success: false, message: "Please provide a valid pitch ID, start date, and end date." })
            return;
        };

        const pitch = await checkIfPitchExists(pitchId);
    
        if (!pitch) {
            res.status(404).json({ success: false, message: "Failed to create reservation. Could not find pitch with the specified ID." });
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const reservation = await createUserReservation(pitchId, userId, start, end);

        if (!reservation) {
            res.status(400).json({ success: false, message: "Failed to create reservation." });
            return;
        }

        res.status(201).json({ success: true, message: "Reservation created successfully.", data: reservation });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleCreateOwnerReservation(req: Request, res: Response) {
    try {
        const { pitchId, name, phone, startDate, endDate } = req.body;
        const ownerId = req.user.id;
        
        if (!pitchId || !name || !phone || !startDate || !endDate) {
            res.status(400).json({ success: false, message: "Please provide a valid pitch ID, name, phone number, start date, and end date." });
            return;
        }

        const pitch = await checkIfPitchExists(pitchId);

        if (!pitch) {
            res.status(404).json({ success: false, message: "Failed to create reservation. Could not find pitch with the specified ID." });
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const reservation = await createOwnerReservation(ownerId, pitchId, name, phone, start, end);

        if (!reservation) {
            res.status(400).json({ success: false, message: "Failed to create reservation." });
            return;
        }

        res.status(201).json({ success: true, message: "Reservation created successfully.", data: reservation });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleFetchReservation(req: Request, res: Response) {
    try {
        const reservationId = req.params.reservation;
        const pitchId = req.params.pitch;
        const user = req.user;
    
        if (pitchId && user.type == "Owner") {
            const pitch = await getPitch(pitchId);

            if (!pitch) {
                res.status(404).json({ success: false, message: "Failed to fetch reservation details. Could not find pitch with the specified ID." });
                return;
            }

            if (pitch.ownerId != user.id) {
                res.status(403).json({ success: false, message: "You are not authorized to view this reservation." });
                return;
            }
        }

        if (!reservationId) {
            res.status(400).json({ success: false, message: "Please provide a valid ID to fetch reservation details." });
            return;
        }

        const reservation = await fetchReservation(reservationId, user.id, user.type);
        res.status(200).json({ success: true, message: "Fetched reservation details successfully.", data: reservation });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleFetchAllReservations(req: Request, res: Response) {
    try {
        const userId = req.user.id;
        const userType = req.user.type;

        const cursor = req.query.cursor as string;
        const limit = Number(req.query.limit) || 5;

        if (userType == "User") {
            const reservations = await fetchAllReservations(userId, cursor, limit);
            res.status(200).json({ success: true, message: "Fetched all user reservations successfully.", data: reservations });
            return;
        }
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleFetchScheduledReservations(req: Request, res: Response) {
    try {
        const userId = req.user.id;
        const userType = req.user.type;

        const cursor = req.query.cursor as string;
        const limit = Number(req.query.limit) || 5;

        if (userType == "User") {
            const reservations = await fetchScheduledReservations(userId, cursor, limit);
            res.status(200).json({ success: true, message: "Fetched scheduled user reservations successfully.", data: reservations });
            return;
        }
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleFetchDoneReservations(req: Request, res: Response) {
    try {
        const userId = req.user.id;
        const userType = req.user.type;

        const cursor = req.query.cursor as string;
        const limit = Number(req.query.limit) || 5;

        if (userType == "User") {
            const reservations = await fetchDoneReservations(userId, cursor, limit);
            res.status(200).json({ success: true, message: "Fetched scheduled user reservations successfully.", data: reservations });
            return;
        }
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}
