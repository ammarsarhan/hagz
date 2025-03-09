import { Worker } from 'bullmq';
import { getReservationData } from '../repositories/reservationRepository';
import prisma from '../utils/db';
import redis from '../utils/redis';

const options = {
    connection: redis,
    concurrency: 50
};

const handleStartReservation = async (id: string) => {
    const reservation = await getReservationData(id, ["status"]);

    if (reservation.status != "PENDING") {
        console.log("Failed to set reservation to start. Reservation is already cancelled.");    
        return;
    }

    const updated = await prisma.reservation.update({
        where: {
            id: id
        },
        data: {
            status: "IN_PROGRESS"
        }
    })

    console.log("[ReservationWorker] Reservation started:", id);

    if (!updated) {
        throw new Error("Could not update reservation to start. Please handle this manually.");
    }
}

const handleEndReservation = async (id: string) => {
    const reservation = await getReservationData(id, ["status"]);

    if (reservation.status != "IN_PROGRESS") {
        console.log("Failed to set reservation to end. Reservation has not started yet.");    
        return;
    }

    const updated = await prisma.reservation.update({
        where: {
            id: id
        },
        data: {
            status: "DONE"
        }
    })

    console.log("[ReservationWorker] Reservation ended:", id);

    if (!updated) {
        throw new Error("Could not update reservation to complete. Please handle this manually.");
    }
}

const handleExpireReservation = async (id: string) => {
    const reservation = await getReservationData(id, ["status"]);

    if (reservation.status != "CONFIRMED") {
        const updated = await prisma.reservation.update({
            where: {
                id: id
            },
            data: {
                status: "CANCELLED"
            }
        })

        console.log("[ReservationWorker] Reservation has not been confirmed yet. Cancelling:", id);
    
        if (!updated) {
            throw new Error("Could not update reservation to cancel. Please handle this manually.");
        }
    }
}

// const handleDeleteReservation = async (id: string) => {
//     const reservation = await prisma.reservation.delete({
//         where: {
//             id: id
//         }
//     })

//     if (!reservation) {
//         throw new Error("Could not delete reservation. Please handle this manually.");
//     }
// }

const reservationWorker = new Worker('reservationQueue', async (job) => {
    try {
        const id = job.data.id;
        const type = job.name;
    
        switch (type) {
            case "start":
                await handleStartReservation(id);
                break;
            case "end":
                await handleEndReservation(id);
                break;
            case "expire":
                await handleExpireReservation(id);
                break;
            // case "delete":
            //     await handleDeleteReservation(id);
            //     break;
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}, options);

reservationWorker.on("error", (error) => {
    console.error("[ReservationWorker] Worker error:", error);
});

reservationWorker.on("failed", (job, error) => {
    console.error(`[ReservationWorker] Job ${job?.id} failed after retries:`, error);
});

console.log(`[ReservationWorker] Listening on 'reservationQueue' with concurrency ${options.concurrency}...`);
