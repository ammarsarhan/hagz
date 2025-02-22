import prisma from "../utils/db";

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

export async function createReservation({ pitchId, name, phone, startDate, endDate, userId, createdBy } : { pitchId: string, name: string, phone: string, startDate: Date, endDate: Date, userId?: string, createdBy: "USER" | "OWNER" }) {
    try {
        const dateConflict = await checkReservationDateConflict(pitchId, startDate, endDate);

        if (dateConflict) {
            throw new Error("Could not reserve for the specified date. Please pick an empty reservation slot.");
        }

        const reservation = await prisma.reservation.create({
            data: {
                pitchId,
                reserveeName: name,
                reserveePhone: phone,
                startDate,
                endDate,
                userId,
                createdBy
            }
        });

        if (!reservation) {
            throw new Error("Failed to create reservation.");
        }
    
        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function checkReservationDateConflict(id: string, startDate: Date, endDate: Date): Promise<Boolean> {
    const match = await prisma.reservation.findFirst({
        where: {
            pitchId: id,
            startDate: { lt: endDate },
            endDate: { gt: startDate }
        }
    })

    if (match) return true;
    return false;
}

export async function getReservation(id: string) {
    try {
        const reservation = await prisma.reservation.findUnique({
            where: {
                id
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
                { status: "CONFIRMED" }
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

export async function setReservationToken(id: string, token: string) {
    try {
        const reservation = await prisma.reservation.update({
            where: { id },
            data: { verificationToken: token }
        });

        if (!reservation) {
            throw new Error("Failed to set reservation token.");
        }

        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function updateReservationVerification(id: string, token: string) {
    try {
        const reservation = await prisma.reservation.update({
            where: {
                id: id,
                verificationToken: token
            },
            data: {
                status: "CONFIRMED",
                verificationToken: null
            }
        })

        if (!reservation) {
            throw new Error("Failed to verify reservation. Please try again later.");
        }

        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function validateReservationOwnership(id: string, userId: string, userType: "User" | "Owner") {
    try {
        const reservation = await prisma.reservation.findUnique({
            where: {
                id: id,
                userId: userType == "User" ? userId : undefined,
                pitch: {
                    ownerId: userType == "Owner" ? userId : undefined
                }
            }
        })

        if (reservation) {
            return true;
        } else {
            return false;
        }

    } catch (error: any) {
        throw new Error(error.message);
    }
}
