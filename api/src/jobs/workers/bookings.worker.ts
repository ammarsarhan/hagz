import { Worker } from "bullmq";
import { Redis } from "ioredis";
import prisma from "@/shared/lib/utils/prisma.js";
import { BookingEvent, type BookingJobPayload } from "@/shared/types/bookings.js";
import { InternalServerError } from "@/shared/lib/utils/error.js";
import { BookingStatus, SlotStatus } from "@/generated/prisma/enums.js";
import { bookingsQueue } from "../queues/bookings.queue.js";
import BookingService from "@/domains/bookings/bookings.service.js";

const bookingsWorker = new Worker<BookingJobPayload>("bookings", 
    async (job) => {
        try {
            switch (job.data.event) {
                case BookingEvent.APPROVAL:
                    {
                        const bookingId = job.data.bookingId;
                        return await handleApprovalExpiry(bookingId);
                    }
                case BookingEvent.PAYMENT:
                    {
                        const bookingId = job.data.bookingId;
                        return await handlePaymentExpiry(bookingId);
                    }
                case BookingEvent.IN_PROGRESS:
                    {
                        const bookingId = job.data.bookingId;
                        return await handleStartBooking(bookingId);
                    }
                case BookingEvent.COMPLETE:
                    {
                        const bookingId = job.data.bookingId;
                        return await handleEndBooking(bookingId);
                    }
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
        // Update the booking to expired and allow all the groundSlots to be booked again.
        await prisma.$transaction(async tx => {
            await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.EXPIRED } });
            await tx.groundSlot.updateMany({ where: { bookingId }, data: { status: SlotStatus.AVAILABLE, bookingId: null } });
        });

        // Remove all of the upcoming jobs in the booking's lifecycle because it has expired.
        await BookingService.dequeueBookingLifecycle(bookingId, BookingEvent.APPROVAL);
    };
};

const handlePaymentExpiry = async (bookingId: string) => {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { slots: true }});

    if (!booking)
        throw new InternalServerError("Could not find a booking with the specified ID.");

    if (booking.status !== BookingStatus.CONFIRMED) {
        // Update the booking to expired and allow all the groundSlots to be booked again.
        await prisma.$transaction(async tx => {
            await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.EXPIRED } });
            await tx.groundSlot.updateMany({ where: { bookingId }, data: { status: SlotStatus.AVAILABLE, bookingId: null } });

        });

        // Remove all of the upcoming jobs in the booking's lifecycle because it has expired.
        await BookingService.dequeueBookingLifecycle(booking.id, BookingEvent.PAYMENT);
    };
};

const handleStartBooking = async (bookingId: string) => {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { slots: true }});

    if (!booking)
        throw new InternalServerError("Could not find a booking with the specified ID.");
    
    // Only start the booking if the booking has not been expired.
    if (booking.status === BookingStatus.CONFIRMED) {
        await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.IN_PROGRESS } });
        return;
    };

    // If for some reason we reach this block, remove the end booking job from the booking.
    await BookingService.dequeueBookingLifecycle(bookingId, BookingEvent.IN_PROGRESS);
};

const handleEndBooking = async (bookingId: string) => {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { slots: true }});

    if (!booking)
        throw new InternalServerError("Could not find a booking with the specified ID.");
    
    // Only start the booking if the booking has not been expired.
    if (booking.status === BookingStatus.IN_PROGRESS) {
        await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.COMPLETED } });
    };
};

// Handle failing and mark for manual resolving.
bookingsWorker.on("failed", async (job, err) => {
    if (!job) return;
    console.error(`[bookings-worker] job ${job.id} (${job.name}) failed for booking ${job.data.bookingId}:`, err.message);
});