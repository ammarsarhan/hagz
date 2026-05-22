import { Worker } from "bullmq";
import { Redis } from "ioredis";
import type { BookingJobPayload } from "@/shared/types/bookings.js";

const bookingsWorker = new Worker<BookingJobPayload>("bookings", 
    async (job) => {

    },
    { 
        connection: new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
    }
);

// Handle failing and mark for manual resolving.
bookingsWorker.on("failed", async (job, err) => {
    // Removed update function from this block because it's already being done on the worker main block.
    if (!job) return;
    console.error(`[bookings-worker] job ${job.id} (${job.name}) failed for booking ${job.data.bookingId}:`, err.message);
});