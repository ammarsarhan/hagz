import { Request, Response } from "express";

import { checkIfPitchExists } from "../repositories/pitchRepository";

import { 
    createUserReservation, 
    createOwnerReservation, 
    fetchReservation, 
    fetchAllReservations, 
    fetchScheduledReservations,
    fetchDoneReservations,
    generateTokenAndNotifyUser,
    verifyReservation
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
        const { name, phone, startDate, endDate } = req.body;
        const pitchId = req.params.pitch;
        
        if (!name || !phone || !startDate || !endDate) {
            res.status(400).json({ success: false, message: "Please provide a valid name, phone number, start date, and end date." });
            return;
        }

        const pitch = await checkIfPitchExists(pitchId);

        if (!pitch) {
            res.status(404).json({ success: false, message: "Failed to create reservation. Could not find pitch with the specified ID." });
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const reservation = await createOwnerReservation(pitchId, name, phone, start, end);

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
        const pitch = req.params.pitch;
        const id = req.params.reservation;
        const user = req.user;
    
        if (!id) {
            res.status(400).json({ success: false, message: "Please provide a valid ID to fetch reservation details." });
            return;
        }
        
        const reservation = await fetchReservation(id, user.id, user.type);
        
        if (pitch && reservation.pitchId !== pitch) {
            res.status(404).json({ success: false, message: "Could not find a reservation with the specified credentials." });
            return;
        }

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
            const data = await fetchAllReservations(userId, cursor, limit, userType);
            res.status(200).json({ success: true, message: "Fetched all user reservations successfully.", data: data });
            return;
        }

        if (userType == "Owner") {
            const pitch = req.params.pitch;
            const data = await fetchAllReservations(pitch, cursor, limit, userType);

            res.status(200).json({ success: true, message: "Fetched all pitch reservations successfully.", data: data });
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
            const data = await fetchScheduledReservations(userId, cursor, limit, userType);
            res.status(200).json({ success: true, message: "Fetched scheduled user reservations successfully.", data: data });
            return;
        }

        if (userType == "Owner") {
            const pitch = req.params.pitch;
            const data = await fetchScheduledReservations(pitch, cursor, limit, userType);

            res.status(200).json({ success: true, message: "Fetched all pitch reservations successfully.", data: data });
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
            const reservations = await fetchDoneReservations(userId, cursor, limit, userType);
            res.status(200).json({ success: true, message: "Fetched scheduled user reservations successfully.", data: reservations });
            return;
        }

        if (userType == "Owner") {
            const pitch = req.params.pitch;
            const data = await fetchDoneReservations(pitch, cursor, limit, userType);

            res.status(200).json({ success: true, message: "Fetched all pitch reservations successfully.", data: data });
            return;
        }
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleSendReservationEmail(req: Request, res: Response) {
    try {
        const { pitch, reservation } = req.params;

        if (!pitch || !reservation) {
            res.status(400).json({ success: false, message: "Please provide a valid pitch and reservation ID." });
            return;
        }

        await generateTokenAndNotifyUser(pitch, reservation);
        res.status(200).json({ success: true, message: "Reservation verification email re-sent successfully." });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleVerifyReservation(req: Request, res: Response) {
    try {
        const token = req.query.token as string;
        
        if (!token) {
            throw new Error("Please provide a valid token to verify the reservation.");
        }

        const data = await verifyReservation(token);
        res.status(200).json({ success: true, message: "Your reservation has been verified successfully!", data: data });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}
