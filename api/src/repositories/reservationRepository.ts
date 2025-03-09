import prisma from "../utils/db";
import { z } from "zod";
import { AccountType } from "@prisma/client";
import { getPitchData } from "./pitchRepository";
import { PitchSettingsType } from "../types/pitch";

type CreateReservationType = { 
    pitchId: string, 
    name: string, 
    phone: string, 
    startDate: Date, 
    endDate: Date, 
    createdBy: AccountType 
    userId?: string
}

export async function checkIfReservationExists(id: string, pitch?: string) {
    try {
        const reservation = await prisma.reservation.findUnique({
            where: {
                id: id,
                pitchId: pitch ? pitch : undefined
            }
        });

        if (reservation) return true;
        return false;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function createReservation({ pitchId, name, phone, startDate, endDate, userId, createdBy } : CreateReservationType) {
    try {
        const pitch = await getPitchData(pitchId, ["settings"]);
        const settings = pitch.settings as PitchSettingsType;

        const paymentPolicy = settings.paymentPolicy;
        await checkReservationDateConflict(pitchId, startDate, endDate, paymentPolicy);

        const reservation = await prisma.reservation.create({
            data: {
                pitchId,
                reserveeName: name,
                reserveePhone: phone,
                startDate,
                endDate,
                userId,
                createdBy,
                isApproved: true
            },
            include: {
                pitch: true
            }
        });

        if (!reservation) {
            throw new Error("Failed to create reservation.");
        };
    
        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getReservation(id: string) {
    try {
        const reservation = await prisma.reservation.findUnique({
            where: {
                id
            },
            include: {
                pitch: {
                    select: {
                        ownerId: true
                    }
                }
            }
        });

        if (!reservation) {
            throw new Error("Could not find reservation with the specified ID.");
        }

        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getReservationData(id: string, fields: string[]) {
    try {
        const fieldSchema = z.array(z.enum(["*", "paymentId", "pitchId", "userId", "ownerId", "reserveeName", "reserveePhone", "startDate", "endDate", "verificationToken", "isApproved", "approvalExpiry", "createdAt", "updatedAt", "createdBy", "status"])).nonempty();
        const parsed = fieldSchema.safeParse(fields);

        if (!parsed.success) {
            throw new Error("Invalid fields provided. Unable to fetch reservation specific data.");
        }
        
        const reservation = await prisma.reservation.findUnique({
            where: {
                id
            }, 
            select: {
                id: true,
                userId: parsed.data.includes("userId"),
                reserveeName: parsed.data.includes("reserveeName"),
                reserveePhone: parsed.data.includes("reserveePhone"),
                startDate: parsed.data.includes("startDate"),
                endDate: parsed.data.includes("endDate"),
                verificationToken: parsed.data.includes("verificationToken"),
                isApproved: parsed.data.includes("isApproved"),
                approvalExpiry: parsed.data.includes("approvalExpiry"),
                createdAt: parsed.data.includes("createdAt"),
                updatedAt: parsed.data.includes("updatedAt"),
                createdBy: parsed.data.includes("createdBy"),
                status: parsed.data.includes("status"),
                pitch: {
                    select: {
                        id: true,
                        ownerId: parsed.data.includes("ownerId")
                    }
                },
                payment: {
                    select: {
                        id: true
                    }
                }
            }
        })

        if (!reservation) {
            throw new Error("Could not find reservation with the specified ID.");
        }

        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function approveReservation(id: string) {
    try {
        const now = new Date();
        const reservation = await getReservationData(id, ["isApproved", "approvalExpiry"]);

        if (reservation.isApproved) {
            throw new Error("Failed to approve reservation. Reservation has already been approved.");
        }

        if (reservation.approvalExpiry == null || reservation.approvalExpiry >= now) {
            throw new Error("Failed to approve reservation. Reservation approval window has expired, automatically cancelling the reservation.");
        }

        const updated = await prisma.reservation.update({
            where: { id },
            data: {
                isApproved: true
            }
        });

        return updated;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function checkReservationDateConflict(id: string, startDate: Date, endDate: Date, policy: "SHORT" | "DEFAULT" | "EXTENDED") {
    const now = new Date();

    const expiryDate = new Date(startDate);
    expiryDate.setUTCHours(expiryDate.getUTCHours() - 1);

    let limitFactor = 1;

    switch (policy) {
        case "SHORT":
            limitFactor = 0;
            break;
        case "EXTENDED":
            limitFactor = 2;
            break;
    }
    
    const limitDate = new Date(expiryDate);
    limitDate.setUTCHours(limitDate.getUTCHours() - limitFactor);

    if (startDate < now) {
        throw new Error("Could not reserve for the specified date. Please pick an upcoming date.");
    };

    if (limitDate < now) {
        throw new Error(`Could not reserve for the specified date. Pitch policy requires that reservation be created at least one hour before the reservation.${limitFactor != 0 ? ` And user have a ${limitFactor} hour payment grace period.` : ""}`);
    };
    

    const match = await prisma.reservation.findFirst({
        where: {
            pitchId: id,
            startDate: { lt: endDate },
            endDate: { gt: startDate }
        }
    })

    if (match) {
        throw new Error("Could not reserve for the specified date. Please pick an empty reservation slot.");
    }
}

export async function getAllUserReservations(id: string, limit: number, cursor?: string) {
    try {
        const reservations = await prisma.reservation.findMany({
            where: { userId: id },
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: cursor ? 1 : 0
        })

        return reservations;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getScheduledUserReservations(id: string, limit: number, cursor?: string) {
    const reservations = await prisma.reservation.findMany({
        where: { 
            userId: id,
            OR: [
                { status: "PENDING" },
                { status: "CONFIRMED" },
            ]
        },
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: cursor ? 1 : 0
    })

    return reservations;
}

export async function getDoneUserReservations(id: string, limit: number, cursor?: string) {
    const reservations = await prisma.reservation.findMany({
        where: { 
            userId: id,
            OR: [
                { status: "IN_PROGRESS" },
                { status: "DONE" }
            ]
        },
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: cursor ? 1 : 0
    })

    return reservations;
}

export async function getAllPitchReservations(id: string, limit: number, cursor?: string) {
    try {
        const reservations = await prisma.reservation.findMany({
            where: { pitchId: id },
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: cursor ? 1 : 0
        })

        return reservations;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getScheduledPitchReservations(id: string, limit: number, cursor?: string) {
    try {
        const reservations = await prisma.reservation.findMany({
            where: { 
                pitchId: id,
                OR: [
                    { status: "PENDING" },
                    { status: "CONFIRMED" }
                ]
            },
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: cursor ? 1 : 0
        })

        return reservations;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getDonePitchReservations(id: string, limit: number, cursor?: string) {
    try {
        const reservations = await prisma.reservation.findMany({
            where: { 
                pitchId: id,
                OR: [
                    { status: "IN_PROGRESS" },
                    { status: "DONE" }
                ]
            },
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: cursor ? 1 : 0
        })

        return reservations;
    } catch (error: any) {
        throw new Error(error.message);
    }
}
