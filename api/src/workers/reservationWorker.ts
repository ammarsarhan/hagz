import prisma from '../utils/db';
import { redis } from '../utils/redis';
import { Worker } from 'bullmq';

const options = {
    connection: redis,
    concurrency: 50
};

const handleStartReservation = async (id: string) => {
    const reservation = await prisma.reservation.update({
        where: {
            id: id
        },
        data: {
            status: "IN_PROGRESS"
        }
    })

    if (!reservation) {
        throw new Error("Could not update reservation to start.");
    }
}

const handleEndReservation = async (id: string) => {
    const reservation = await prisma.reservation.update({
        where: {
            id: id
        },
        data: {
            status: "DONE"
        }
    })

    if (!reservation) {
        throw new Error("Could not update reservation to complete.");
    }
}

const handleCancelReservation = async (id: string) => {
    const reservation = await prisma.reservation.update({
        where: {
            id: id
        },
        data: {
            status: "CANCELLED"
        }
    })

    if (!reservation) {
        throw new Error("Could not update reservation to cancel.");
    }
}

const reservationWorker = new Worker('reservationQueue', async (job) => {
    try {
        const data = job.data;
        const type = job.name;
    
        switch (type) {
            case "start":
                await handleStartReservation(data.id);
                break;
            case "end":
                await handleEndReservation(data.id);
                break;
            case "cancel":
                await handleCancelReservation(data.id);
                break;
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
