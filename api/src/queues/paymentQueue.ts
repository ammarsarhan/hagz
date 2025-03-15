import { Queue } from "bullmq";
import redis from "../utils/redis";

const now = new Date();

export async function createPaymentJob(id: string, paymentExpiry: Date) {
    const paymentDelay = paymentExpiry.getTime() - now.getTime();

    paymentQueue.add("expire", { id: id }, {
        delay: 20000,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true
    })
}

export const paymentQueue = new Queue("paymentQueue", {
    connection: redis
});