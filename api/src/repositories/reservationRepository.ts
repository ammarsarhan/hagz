import prisma from "../utils/db";

export async function createReservation({ pitchId, name, phone, startDate, endDate, userId } : { pitchId: string, name: string, phone: string, startDate: Date, endDate: Date, userId?: string }) {
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
                userId
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