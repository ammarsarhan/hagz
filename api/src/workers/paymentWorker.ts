import { Worker } from 'bullmq';
import { getPaymentData } from '../repositories/paymentRepository';
import redis from '../utils/redis';
import prisma from '../utils/db';

const options = {
    connection: redis,
    concurrency: 50
};

const paymentWorker = new Worker('paymentQueue', async job => {
    try {
        const id = job.data.id;
        const payment = await getPaymentData(id, ["status", "isManual"]);

        if (!payment.isManual && payment.status != "PAID") {
            const payment = await prisma.payment.update({
                where: { id },
                data: { status: "EXPIRED" }
            })

            if (!payment) {
                throw new Error("Could not update payment to expired. Please handle this manually.");
            }

            console.log("[PaymentWorker] Payment expired:", id);
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}, options);

paymentWorker.on("error", (error) => {
    console.error("[PaymentWorker] Worker error:", error);
});

paymentWorker.on("failed", (job, error) => {
    console.error(`[PaymentWorker] Job ${job?.id} failed after retries:`, error);
});

console.log(`[PaymentWorker] Listening on 'paymentQueue' with concurrency ${options.concurrency}...`);