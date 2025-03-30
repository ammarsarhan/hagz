import prisma from "../utils/db";

export async function getReservations(pitch: string, index: number, start: Date, end: Date) {
    const reservations = await prisma.reservation.findMany({
        where: {
            ground: {
                pitchId: pitch,
                index: index
            },
            startDate: {
                gte: start
            },
            endDate: {
                lte: end
            }
        }
    });

    return reservations;
}