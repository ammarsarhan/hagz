import { Request, Response } from "express";
import { checkIfPitchExists } from "../repositories/pitchRepository";

import { 
    createUserReservation,
    fetchReservation, 
    fetchAllReservations, 
    fetchScheduledReservations,
    fetchDoneReservations,
    createOwnerReservation,
    cancelPendingReservation,
    cancelReservationWithRefund
} from "../services/reservationService";
import { getReservationData } from "repositories/reservationRepository";

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
        res.status(201).json({ success: true, message: "Reservation created successfully.", data: reservation });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleCreatePitchReservation(req: Request, res: Response) {
    try {
        const id = req.params.pitch;
        const { reserveeName, reserveePhone, startDate, endDate, isManual } = req.body;

        if (!id || !reserveeName || !reserveePhone || !startDate || !endDate) {
            res.status(400).json({ success: false, message: "Please provide a valid reservee name, phone, start date, and end date." })
            return;
        };

        const pitch = await checkIfPitchExists(id);
    
        if (!pitch) {
            res.status(404).json({ success: false, message: "Failed to create reservation. Could not find pitch with the specified ID." });
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const reservation = await createOwnerReservation(id, reserveeName, reserveePhone, start, end, isManual);
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
        
        const reservation = await fetchReservation(id);
        
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

export async function handleCancelReservation(req: Request, res: Response) {
    try {
        const id = req.params.reservation;
        const reservation = await getReservationData(id, ["status"]);

        const status = reservation.status;

        if (status == "CANCELLED") {
            res.status(400).json({ success: false, message: "Failed to cancel reservation. Reservation has already been cancelled." });
            return;
        };

        if (status == "PENDING") {
            const updated = await cancelPendingReservation(id);
            res.status(200).json({ success: true, message: "Cancelled pending reservation successfully.", data: updated });
            return;
        };

        if (status == "CONFIRMED") {
            const updated = await cancelReservationWithRefund(id);
            res.status(200).json({ success: true, message: "Cancelled confirmed reservation successfully and issued refund.", data: updated });
            return;
        };
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}
