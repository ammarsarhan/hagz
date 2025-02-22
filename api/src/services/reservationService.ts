import { z } from "zod";
import { User } from "@prisma/client";

import { 
    createReservation, 
    getReservation, 
    getAllUserReservations, 
    getScheduledUserReservations, 
    getDoneUserReservations, 
    getAllPitchReservations, 
    getScheduledPitchReservations,
    getDonePitchReservations,
    checkIfReservationExists,
    setReservationToken,
    updateReservationVerification
} from "../repositories/reservationRepository";

import { fetchUserById, checkIfUserExistsAlready, fetchUserByPhone } from "../repositories/userRepository";
import { getPitch } from "../repositories/pitchRepository";

import { getTimeDifference } from "../utils/date";
import { sendReservationVerificationEmail } from "./mailService";
import { generateReservationToken } from "../utils/token";
import { verify } from "jsonwebtoken";

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

export async function createOwnerReservation(pitchId: string, name: string, phone: string, startDate: Date, endDate: Date) {
    try {
        let user: User | null = null;

        const match = await checkIfUserExistsAlready({ phone });
        if (match) user = await fetchUserByPhone(phone);

        const pitch = await getPitch(pitchId);

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

        let reservation = await createReservation({...parsed.data, createdBy: "OWNER"});

        if (user && match) {
            const token = generateReservationToken({ id: reservation.id, type: "Reservation" });
            const link = `http://localhost:3000/api/reservation/verify?token=${token}`;

            reservation = await setReservationToken(reservation.id, token);
            await sendReservationVerificationEmail(user.email, link);
        }

        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchReservation(reservationId: string) {
    try {
        const schema = z.string().uuid("Please provide a valid UUID for the reservation ID.");
        const parsed = schema.safeParse(reservationId);

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const reservation = await getReservation(parsed.data);
        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchAllReservations(id: string, cursor: string, limit: number, userType: "User" | "Owner") {
    try {
        const schema = z.object({
            cursor: z.string({ message: "Please provide a valid cursor." }).uuid("Please provide a valid pitch UUID for the cursor.").optional(),
            limit: z.number({ message: "Please provide a valid limit to fetch pitches." }).int("Limit must be a valid integer.").min(5, { message: "Limit must at least be 5." }).max(10, { message: "Limit must at most be 10." }).nonnegative("Limit must be a non-negative number.")
        })

        const parsed = schema.safeParse({ cursor, limit });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        };

        if (userType == "User") {
            const reservations = await getAllUserReservations(id, parsed.data.limit, parsed.data.cursor);
            const last = reservations[reservations.length - 1];
    
            return {
                reservations: reservations,
                cursor: last ? last.id : null
            };
        };

        if (userType == "Owner") {
            const reservations = await getAllPitchReservations(id, parsed.data.limit, parsed.data.cursor);
            const last = reservations[reservations.length - 1];

            return {
                reservations: reservations,
                cursor: last ? last.id : null
            };
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchScheduledReservations(id: string, cursor: string, limit: number, userType: "User" | "Owner") {
    try {
        const schema = z.object({
            cursor: z.string({ message: "Please provide a valid cursor." }).uuid("Please provide a valid pitch UUID for the cursor.").optional(),
            limit: z.number({ message: "Please provide a valid limit to fetch pitches." }).int("Limit must be a valid integer.").min(5, { message: "Limit must at least be 5." }).max(10, { message: "Limit must at most be 10." }).nonnegative("Limit must be a non-negative number.")
        })

        const parsed = schema.safeParse({ cursor, limit });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }
        if (userType == "User") {
            const reservations = await getScheduledUserReservations(id, parsed.data.limit, parsed.data.cursor);
            const last = reservations[reservations.length - 1];
    
            return {
                reservations: reservations,
                cursor: last ? last.id : null
            };
        };

        if (userType == "Owner") {
            const reservations = await getScheduledPitchReservations(id, parsed.data.limit, parsed.data.cursor);
            const last = reservations[reservations.length - 1];

            return {
                reservations: reservations,
                cursor: last ? last.id : null
            };
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchDoneReservations(id: string, cursor: string, limit: number, userType: "User" | "Owner") {
    try {
        const schema = z.object({
            cursor: z.string({ message: "Please provide a valid cursor." }).uuid("Please provide a valid pitch UUID for the cursor.").optional(),
            limit: z.number({ message: "Please provide a valid limit to fetch pitches." }).int("Limit must be a valid integer.").min(5, { message: "Limit must at least be 5." }).max(10, { message: "Limit must at most be 10." }).nonnegative("Limit must be a non-negative number.")
        })

        const parsed = schema.safeParse({ cursor, limit });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }
        if (userType == "User") {
            const reservations = await getDoneUserReservations(id, parsed.data.limit, parsed.data.cursor);
            const last = reservations[reservations.length - 1];
    
            return {
                reservations: reservations,
                cursor: last ? last.id : null
            };
        };

        if (userType == "Owner") {
            const reservations = await getDonePitchReservations(id, parsed.data.limit, parsed.data.cursor);
            const last = reservations[reservations.length - 1];

            return {
                reservations: reservations,
                cursor: last ? last.id : null
            };
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchAllPitchReservations(id: string, cursor: string, limit: number, userType: "User" | "Owner") {
    try {
        const schema = z.object({
            cursor: z.string({ message: "Please provide a valid cursor." }).uuid("Please provide a valid pitch UUID for the cursor.").optional(),
            limit: z.number({ message: "Please provide a valid limit to fetch pitches." }).int("Limit must be a valid integer.").min(5, { message: "Limit must at least be 5." }).max(10, { message: "Limit must at most be 10." }).nonnegative("Limit must be a non-negative number.")
        })

        const parsed = schema.safeParse({ cursor, limit });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        if (userType == "User") {
            const reservations = await getAllUserReservations(id, parsed.data.limit, parsed.data.cursor);
            const last = reservations[reservations.length - 1];
    
            return {
                reservations: reservations,
                cursor: last ? last.id : null
            };
        }

        if (userType == "Owner") {
            const reservations = await getAllPitchReservations(id, parsed.data.limit, parsed.data.cursor);
            const last = reservations[reservations.length - 1];

            return {
                reservations: reservations,
                cursor: last ? last.id : null
            };
        }
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function generateTokenAndNotifyUser(pitchId: string, reservationId: string) {
    try {
        const match = await checkIfReservationExists(reservationId, pitchId);
        if (!match) throw new Error("Could not find reservation with specified credentials.");

        const reservation = await getReservation(reservationId);
        if (reservation.userId == null || reservation.verificationToken == null) throw new Error("Cannot generate token for reservation that is either inapplicable or has already been verified.");

        const user = await fetchUserById(reservation.userId);
        if (!user) throw new Error("Could not find user with specified credentials. Please try again later.");

        const token = generateReservationToken({ id: reservation.id, type: "Reservation" });
        const link = `http://localhost:3000/api/reservation/verify?token=${token}`;

        await setReservationToken(reservationId, token);
        await sendReservationVerificationEmail(user.email, link);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function verifyReservation(token: string) {
    try {
        const decoded = verify(token, process.env.RESERVATION_SECRET_KEY || "");

        if (typeof decoded == "object") {
            const target = decoded.id;
            const reservation = await getReservation(target);

            if (reservation.status == "CONFIRMED" || reservation.verificationToken == null) {
                throw new Error("Failed to verify reservation. This reservation has already been verified.");
            }

            const updated = await updateReservationVerification(target, token);
            return updated;
        } else {
            throw new Error("Invalid verification token provided.");
        }
    } catch (error: any) {
        throw new Error(error.message);
    }
}
