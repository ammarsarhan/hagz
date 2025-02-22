import { z } from "zod";
import { User } from "@prisma/client";

import { createReservation, getReservation, getAllUserReservations, getScheduledUserReservations, getDoneUserReservations } from "../repositories/reservationRepository";
import { fetchUserById, checkIfUserExistsAlready, fetchUserByPhone } from "../repositories/userRepository";
import { getPitch } from "../repositories/pitchRepository";

import { getTimeDifference } from "../utils/date";

export async function createUserReservation(pitchId: string, userId: string, startDate: Date, endDate: Date) {
    try {
        const user = await fetchUserById(userId);
        const pitch = await getPitch(pitchId);

        if (!user || !pitch) {
            throw new Error("Failed to create reservation. Could not find user or pitch with the specified credentials.");
        }
    
        const schema = z.object({
            pitchId: z.string().cuid("Please provide a valid CUID for the pitch ID."),
            name: z.string({ message: "Please provide a reservee name." }).min(2, { message: "Name must contain at least 2 characters." }).max(100, { message: "Name may not have more than 100 characters." }),
            phone: z.string().regex(/^\d{4}-\d{3}-\d{4}$/, "Please provide a valid phone number."),
            startDate: z.date({ message: "Please provide a valid start date." }),
            endDate: z.date({ message: "Please provide a valid end date." }),
            userId: z.string().cuid("Please provide a valid CUID for the user ID.").optional(),
        }).refine(data => data.startDate < data.endDate, {
            message: "Start date may not be before or equal to the end date. Please choose a valid date range.",
        });

        const parsed = schema.safeParse({ 
            pitchId: pitch.id,
            name: user.name,
            phone: user.phone,
            startDate,
            endDate,
            userId: user.id
         });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const sessionDuration = getTimeDifference(startDate, endDate);

        if (sessionDuration < pitch.minimumSession || sessionDuration > pitch.maximumSession) {
            if (pitch.minimumSession == pitch.maximumSession) {
                throw new Error(`Reservation duration must be exactly ${pitch.minimumSession} hours long.`);
            } else {
                throw new Error(`Reservation duration must be between ${pitch.minimumSession} and ${pitch.maximumSession} hours long.`);
            }
        }

        const reservation = await createReservation({...parsed.data, createdBy: "USER"});
        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function createOwnerReservation(ownerId: string, pitchId: string, name: string, phone: string, startDate: Date, endDate: Date) {
    try {
        let user: User | null = null;

        const match = await checkIfUserExistsAlready({ phone });
        if (match) user = await fetchUserByPhone(phone);

        const pitch = await getPitch(pitchId);

        if (!pitch) {
            throw new Error("Failed to create reservation. Could not find user or pitch with the specified credentials.");
        }
        
        if (pitch.ownerId != ownerId) {
            throw new Error("You are not authorized to create reservations for the following pitch. Please sign in with valid credentials and try again later.");
        }

        const schema = z.object({
            pitchId: z.string().cuid("Please provide a valid CUID for the pitch ID."),
            name: z.string({ message: "Please provide a reservee name." }).min(2, { message: "Name must contain at least 2 characters." }).max(100, { message: "Name may not have more than 100 characters." }),
            phone: z.string().regex(/^\d{4}-\d{3}-\d{4}$/, "Please provide a valid phone number."),
            startDate: z.date({ message: "Please provide a valid start date." }),
            endDate: z.date({ message: "Please provide a valid end date." }),
            userId: z.string().cuid("Please provide a valid CUID for the user ID.").optional()
        }).refine(data => data.startDate < data.endDate, {
            message: "Start date may not be before or equal to the end date. Please choose a valid date range.",
        });

        const parsed = schema.safeParse({ 
            pitchId: pitch.id,
            name: user ? user.name : name,
            phone: user ? user.phone : phone,
            startDate,
            endDate,
            userId: user ? user.id : undefined
         });

         if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const sessionDuration = getTimeDifference(startDate, endDate);

        if (sessionDuration < pitch.minimumSession || sessionDuration > pitch.maximumSession) {
            if (pitch.minimumSession == pitch.maximumSession) {
                throw new Error(`Reservation duration must be exactly ${pitch.minimumSession} hours long.`);
            } else {
                throw new Error(`Reservation duration must be between ${pitch.minimumSession} and ${pitch.maximumSession} hours long.`);
            }
        }

        const reservation = await createReservation({...parsed.data, createdBy: "OWNER"});
        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchReservation(reservationId: string, userId: string, userType: "User" | "Owner") {
    try {
        const schema = z.string().uuid("Please provide a valid UUID for the reservation ID.");
        const parsed = schema.safeParse(reservationId);

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const reservation = await getReservation(parsed.data);

        if (userType == "User" && reservation.userId != userId) {
            throw new Error("You are not authorized to view the details of this reservation. To access this reservation please sign in as the user that created it.");
        }

        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchAllReservations(id: string, cursor: string, limit: number) {
    try {
        const schema = z.object({
            cursor: z.string({ message: "Please provide a valid cursor." }).uuid("Please provide a valid pitch UUID for the cursor.").optional(),
            limit: z.number({ message: "Please provide a valid limit to fetch pitches." }).int("Limit must be a valid integer.").min(5, { message: "Limit must at least be 5." }).max(10, { message: "Limit must at most be 10." }).nonnegative("Limit must be a non-negative number.")
        })

        const parsed = schema.safeParse({ cursor, limit });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const reservations = await getAllUserReservations(id, parsed.data.limit, parsed.data.cursor);
        const last = reservations[reservations.length - 1];

        return {
            reservations: reservations,
            cursor: last ? last.id : null
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchScheduledReservations(id: string, cursor: string, limit: number) {
    try {
        const schema = z.object({
            cursor: z.string({ message: "Please provide a valid cursor." }).uuid("Please provide a valid pitch UUID for the cursor.").optional(),
            limit: z.number({ message: "Please provide a valid limit to fetch pitches." }).int("Limit must be a valid integer.").min(5, { message: "Limit must at least be 5." }).max(10, { message: "Limit must at most be 10." }).nonnegative("Limit must be a non-negative number.")
        })

        const parsed = schema.safeParse({ cursor, limit });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const reservations = await getScheduledUserReservations(id, parsed.data.limit, parsed.data.cursor);
        const last = reservations[reservations.length - 1];

        return {
            reservations: reservations,
            cursor: last ? last.id : null
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchDoneReservations(id: string, cursor: string, limit: number) {
    try {
        const schema = z.object({
            cursor: z.string({ message: "Please provide a valid cursor." }).uuid("Please provide a valid pitch UUID for the cursor.").optional(),
            limit: z.number({ message: "Please provide a valid limit to fetch pitches." }).int("Limit must be a valid integer.").min(5, { message: "Limit must at least be 5." }).max(10, { message: "Limit must at most be 10." }).nonnegative("Limit must be a non-negative number.")
        })

        const parsed = schema.safeParse({ cursor, limit });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const reservations = await getDoneUserReservations(id, parsed.data.limit, parsed.data.cursor);
        const last = reservations[reservations.length - 1];

        return {
            reservations: reservations,
            cursor: last ? last.id : null
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}