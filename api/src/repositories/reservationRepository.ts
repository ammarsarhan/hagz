import prisma from "../utils/db";

export async function checkReservationConflict(pitch: string, ground: number, startDate: Date, endDate: Date) {
    try {
        const match = await prisma.reservation.findFirst({
            where: {
                ground: {
                    pitchId: pitch,
                    index: ground
                },
                startDate: { lt: endDate },
                endDate: { gt: startDate }
            }
        });

        return !!match;
    } catch (error: any) {
        throw new Error(error.message);
    }
}