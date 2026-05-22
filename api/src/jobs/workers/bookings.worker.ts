import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { BookingEvent, type BookingJobPayload } from "@/shared/types/bookings.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { InternalServerError } from "@/shared/lib/utils/error.js";
import { BookingStatus } from "@/generated/prisma/enums.js";

const bookingsWorker = new Worker<BookingJobPayload>("bookings", 
    async (job) => {
        try {
            switch (job.data.event) {
                case BookingEvent.APPROVAL:
                    return await handleApprovalExpiry(job.data.bookingId);
                
            }
        } catch (error: any) {
            // Todo: Implement better error handling for the booking job state transition failure.
            console.log(error.message);
        }
    },
    { 
        connection: new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
    }
);

const handleApprovalExpiry = async (bookingId: string) => {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { slots: true }});

    if (!booking)
        throw new InternalServerError("Could not find a booking with the specified ID.")

    if (!booking.isApproved) {
        const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.EXPIRED } });
    }
}

// Handle failing and mark for manual resolving.
bookingsWorker.on("failed", async (job, err) => {
    // Removed update function from this block because it's already being done on the worker main block.
    if (!job) return;
    console.error(`[bookings-worker] job ${job.id} (${job.name}) failed for booking ${job.data.bookingId}:`, err.message);
});