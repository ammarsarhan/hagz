import prisma from "utils/db";

export async function newReservation(pitchId: string, name: string, phone: string, startDate: Date, endDate: Date, userId?: string) {
    try {
        const reservation = await prisma.reservation.create({
            data: {
                pitchId,
                name,
                phone,
                startDate,
                endDate,
                userId
            }
        });
    
        return reservation;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function checkReservationDateConflict(id: string, startDate: Date, endDate: Date): Promise<Boolean> {
    return false;
}