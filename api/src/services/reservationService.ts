import { z } from "zod";

import { 
    createReservation, 
    getReservation, 
    getAllUserReservations, 
    getScheduledUserReservations, 
    getDoneUserReservations, 
    getAllPitchReservations, 
    getScheduledPitchReservations,
    getDonePitchReservations,
    getReservationData,
    confirmReservation,
    cancelReservation
} from "../repositories/reservationRepository";

import { checkIfUserExistsAlready, fetchUserById } from "../repositories/userRepository";
import { getPitch } from "../repositories/pitchRepository";

import { getTimeDifference } from "../utils/date";
import { createReservationJobs } from "../queues/reservationQueue";
import { initiatePayment, processPayment, refundPayment, voidPayment } from "./paymentService";
import { PitchSettingsType } from "../types/pitch";
import { getPaymentData } from "../repositories/paymentRepository";

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
            createdBy: z.enum(["USER", "OWNER"])
        }).refine(data => data.startDate < data.endDate, {
            message: "Start date may not be before or equal to the end date. Please choose a valid date range.",
        });

        const parsed = schema.safeParse({ 
            pitchId: pitch.id,
            name: user.name,
            phone: user.phone,
            startDate,
            endDate,
            userId: user.id,
            createdBy: "USER"
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

        const reservation = await createReservation({ ...parsed.data });
        await createReservationJobs(reservation.id, reservation.startDate, reservation.endDate, pitch.settings.paymentPolicy);
        const payment = await initiatePayment(reservation.id, pitch.price, reservation.startDate, reservation.endDate, pitch.settings.paymentPolicy);

        return { reservation, payment };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function createOwnerReservation(pitchId: string, reserveeName: string, reserveePhone: string, startDate: Date, endDate: Date, isManual?: boolean) {
    try {
        const schema = z.object({
            pitchId: z.string().cuid("Please provide a valid CUID for the pitch ID."),
            name: z.string({ message: "Please provide a reservee name." }).min(2, { message: "Name must contain at least 2 characters." }).max(100, { message: "Name may not have more than 100 characters." }),
            phone: z.string().regex(/^\d{4}-\d{3}-\d{4}$/, "Please provide a valid phone number."),
            startDate: z.date({ message: "Please provide a valid start date." }),
            endDate: z.date({ message: "Please provide a valid end date." }),
            isManual: z.boolean({ message: "Please provide a valid boolean value for manual reservation." }).optional(),
            createdBy: z.enum(["USER", "OWNER"])
        }).refine(data => data.startDate < data.endDate, {
            message: "Start date may not be before or equal to the end date. Please choose a valid date range.",
        });

        const parsed = schema.safeParse({ 
            pitchId: pitchId,
            name: reserveeName,
            phone: reserveePhone,
            startDate,
            endDate,
            isManual,
            createdBy: "OWNER"
         });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const pitch = await getPitch(pitchId);
        pitch.settings as PitchSettingsType;
        
        const match = await checkIfUserExistsAlready({ phone: parsed.data.phone });

        if (match) {
            // Handle this gracefully later. Maybe using OTP?
            throw new Error("Failed to create manual reservation. A user with the specified phone number already exists.");
        }

        const sessionDuration = getTimeDifference(startDate, endDate);

        if (sessionDuration < pitch.minimumSession || sessionDuration > pitch.maximumSession) {
            if (pitch.minimumSession == pitch.maximumSession) {
                throw new Error(`Reservation duration must be exactly ${pitch.minimumSession} hours long.`);
            } else {
                throw new Error(`Reservation duration must be between ${pitch.minimumSession} and ${pitch.maximumSession} hours long.`);
            }
        };

        const reservation = await createReservation({ ...parsed.data });
        await createReservationJobs(reservation.id, reservation.startDate, reservation.endDate, pitch.settings.paymentPolicy);
        const payment = await initiatePayment(reservation.id, pitch.price, reservation.startDate, reservation.endDate, pitch.settings.paymentPolicy, parsed.data.isManual);

        return { reservation, payment };
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

export async function processReservationPayment(reservationId: string, paymentId: string) {
    try {   
        const payment = await processPayment(paymentId);
        const reservation = await confirmReservation(reservationId);

        return { payment, reservation };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function cancelPendingReservation(id: string) {
    try {
        const reservation = await getReservationData(id, ["*"]);
        const payment = reservation.payment;

        if (!payment?.id) {
            throw new Error("Could not find the payment associated with the reservation. Please handle this manually.");
        }

        const voided = await voidPayment(payment.id);
        const updated = await cancelReservation(reservation.id);

        return { reservation: updated, payment: voided };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function cancelReservationWithRefund(id: string) {
    try {
        const reservation = await getReservationData(id, ["*"]);

        if (!reservation.payment?.id) {
            throw new Error("Could not find the payment associated with the reservation. Please handle this manually.");
        }

        const payment = await getPaymentData(reservation.payment.id, ["status", "isManual"]);
        
        if (payment.status == "MANUAL" || payment.isManual) {
            throw new Error("Cannot refund manual reservations. Please handle this manually.");
        }

        const refunded = await refundPayment(payment.id);
        const updated = await cancelReservation(id);

        return { reservation: updated, payment: refunded };
    } catch (error: any) {
        throw new Error(error.message);
    }
}