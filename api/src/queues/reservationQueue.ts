import { Queue } from "bullmq";
import { getPaymentExpiryDate } from "../services/paymentService";
import redis from "../utils/redis";

const now = new Date();

export async function createReservationJobs(id: string, startDate: Date, endDate: Date, policy: "SHORT" | "DEFAULT" | "EXTENDED") {
    const startDelay = startDate.getTime() - now.getTime();
    const endDelay = endDate.getTime() - now.getTime();
    const expiryDelay = getPaymentExpiryDate(startDate, policy).getTime() - now.getTime();

    await reservationQueue.add("expire", { id: id }, 
        {
            delay: 5000,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true
        }
    );

    await reservationQueue.add("start", { id: id }, 
        {
            delay: 7500,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true
        }
    );

    await reservationQueue.add("end", { id: id }, 
        {
            delay: 10000,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true
        }
    );
}

export const reservationQueue = new Queue("reservationQueue", {
    connection: redis
});