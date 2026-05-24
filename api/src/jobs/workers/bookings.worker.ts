import { Worker } from "bullmq";
import { Redis } from "ioredis";
import prisma from "@/shared/lib/utils/prisma.js";
import { BookingEvent, type BookingJobPayload } from "@/shared/types/bookings.js";
import { InternalServerError } from "@/shared/lib/utils/error.js";
import { BookingStatus, NotificationEvent, PermissionLevel, SlotStatus } from "@/generated/prisma/enums.js";
import BookingService from "@/domains/bookings/bookings.service.js";
import NotificationsService from "@/domains/notifications/notifications.service.js";
import { formatInTimeZone } from "date-fns-tz";
import hasPermissions from "@/shared/lib/utils/permissions.js";
import type { Permissions } from "@/shared/types/staff.js";

const bookingsWorker = new Worker<BookingJobPayload>("bookings", 
    async (job) => {
        try {
            switch (job.data.event) {
                case BookingEvent.APPROVAL:
                    {
                        const bookingId = job.data.bookingId;
                        await handleApprovalExpiry(bookingId);
                        break;
                    }
                case BookingEvent.PAYMENT:
                    {
                        const bookingId = job.data.bookingId;
                        await handlePaymentExpiry(bookingId);
                        break;
                    }
                case BookingEvent.IN_PROGRESS:
                    {
                        const bookingId = job.data.bookingId;
                        await handleStartBooking(bookingId);
                        break;
                    }
                case BookingEvent.COMPLETE:
                    {
                        const bookingId = job.data.bookingId;
                        await handleEndBooking(bookingId);
                        break;
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
    // Gigantic query - rabena yestor.
    const booking = await prisma.booking.findUnique({ 
        where: { id: bookingId }, 
        include: { 
            slots: true,
            customer: {
                include: { 
                    user: { 
                        include: { preferences: true }
                    } 
                }
            },
            ground: { 
                select: {
                    name: true,
                    settings: {
                        select: {
                            notificationsTrigger: true
                        }
                    }
                },
            },
            pitch: { 
                select: {
                    name: true,
                    staff: {
                        include: {
                            user: {
                                include: { preferences: true }
                            }
                        }
                    }
                } 
            }
        }
    });

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

        // And send a notification to both the staff and the customer.
        if (!booking.customer)
            throw new InternalServerError("Could not find pitchCustomer record for an initiated booking.");

        const receiverName = booking.customer.firstName ?? booking.customer.user?.firstName;
        const timezone = booking.customer.user?.preferences?.timezone ?? "Africa/Cairo";

        await NotificationsService.createNotification({
            phone: booking.customer.phone,
            event: NotificationEvent.BOOKING_EXPIRED,
            data: {
                receiverName: receiverName!,
                groundName: booking.ground.name,
                pitchName: booking.pitch.name,
                startTime: formatInTimeZone(booking.startTime, timezone, "d-M-yyyy 'at' h aa"),
                action: "expired because it was not approved in time",
                deepLink: `https://www.hagz.com/bookings/${bookingId}`
            }
        });

        if (!booking.ground.settings)
            throw new InternalServerError("Could not resolve settings associated with the booked ground.");

        if (booking.ground.settings.notificationsTrigger.includes(NotificationEvent.BOOKING_EXPIRED)) {
            // Check if the staff member is allowed to recieve booking notifications.
            await Promise.all(booking.pitch.staff.map(async (member) => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

                if (isAllowed) {
                    if (!member.user.preferences)
                        throw new InternalServerError("Could not resolve user preferences associated with the user account.")

                    await NotificationsService.createNotification({
                        phone: member.user.phone,
                        event: NotificationEvent.BOOKING_EXPIRED,
                        data: {
                            receiverName: member.user.firstName,
                            groundName: booking.ground.name,
                            pitchName: booking.pitch.name,
                            startTime: formatInTimeZone(booking.startTime, member.user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                            action: "expired because it was not approved in time",
                            deepLink: `https://www.hagz.com/dashboard/pitches/${booking.pitchId}/grounds/${booking.groundId}/bookings/${bookingId}`
                        }
                    });
                }
            }));
        }
    };
};

const handlePaymentExpiry = async (bookingId: string) => {
    const booking = await prisma.booking.findUnique({ 
        where: { id: bookingId }, 
        include: { 
            slots: true,
            customer: {
                include: { 
                    user: { 
                        include: { preferences: true }
                    } 
                }
            },
            ground: { 
                select: {
                    name: true,
                    settings: {
                        select: {
                            notificationsTrigger: true
                        }
                    }
                },
            },
            pitch: { 
                select: {
                    name: true,
                    staff: {
                        include: {
                            user: {
                                include: { preferences: true }
                            }
                        }
                    }
                } 
            }
        }
    });

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

        // And send a notification to both the staff and the customer.
        const receiverName = booking.customer.firstName ?? booking.customer.user?.firstName;
        const timezone = booking.customer.user?.preferences?.timezone ?? "Africa/Cairo";

        await NotificationsService.createNotification({
            phone: booking.customer.phone,
            event: NotificationEvent.BOOKING_EXPIRED,
            data: {
                receiverName: receiverName!,
                groundName: booking.ground.name,
                pitchName: booking.pitch.name,
                startTime: formatInTimeZone(booking.startTime, timezone, "d-M-yyyy 'at' h aa"),
                action: "expired because it was not paid for in time",
                deepLink: `https://www.hagz.com/bookings/${bookingId}`
            }
        });

        if (!booking.ground.settings)
            throw new InternalServerError("Could not resolve settings associated with the booked ground.");

        if (booking.ground.settings.notificationsTrigger.includes(NotificationEvent.BOOKING_EXPIRED)) {
            // Check if the staff member is allowed to recieve booking notifications.
            await Promise.all(booking.pitch.staff.map(async (member) => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

                if (isAllowed) {
                    if (!member.user.preferences)
                        throw new InternalServerError("Could not resolve user preferences associated with the user account.")

                    await NotificationsService.createNotification({
                        phone: member.user.phone,
                        event: NotificationEvent.BOOKING_EXPIRED,
                        data: {
                            receiverName: member.user.firstName,
                            groundName: booking.ground.name,
                            pitchName: booking.pitch.name,
                            startTime: formatInTimeZone(booking.startTime, member.user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                            action: "expired because it was not paid for in time",
                            deepLink: `https://www.hagz.com/dashboard/pitches/${booking.pitchId}/grounds/${booking.groundId}/bookings/${bookingId}`
                        }
                    });
                }
            }));
        }
    };
};

const handleStartBooking = async (bookingId: string) => {
    const booking = await prisma.booking.findUnique({ 
        where: { id: bookingId }, 
        include: { 
            slots: true,
            customer: {
                include: { 
                    user: { 
                        include: { preferences: true }
                    } 
                }
            },
            ground: { 
                select: {
                    name: true,
                    settings: {
                        select: {
                            notificationsTrigger: true
                        }
                    }
                },
            },
            pitch: { 
                select: {
                    name: true,
                    staff: {
                        include: {
                            user: {
                                include: { preferences: true }
                            }
                        }
                    }
                } 
            }
        }
    });

    if (!booking)
        throw new InternalServerError("Could not find a booking with the specified ID.");
    
    // Only start the booking if the booking has not been expired.
    if (booking.status === BookingStatus.CONFIRMED) {
        await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.IN_PROGRESS } });
        return;
    };

    // If for some reason we reach this block, remove the end booking job from the booking.
    await BookingService.dequeueBookingLifecycle(bookingId, BookingEvent.IN_PROGRESS);

    // And send a notification to both the staff and the customer.
    const receiverName = booking.customer.firstName ?? booking.customer.user?.firstName;
    const timezone = booking.customer.user?.preferences?.timezone ?? "Africa/Cairo";

    await NotificationsService.createNotification({
        phone: booking.customer.phone,
        event: NotificationEvent.BOOKING_STARTED,
        data: {
            receiverName: receiverName!,
            groundName: booking.ground.name,
            pitchName: booking.pitch.name,
            startTime: formatInTimeZone(booking.startTime, timezone, "d-M-yyyy 'at' h aa"),
            action: "marked as in progress",
            deepLink: `https://www.hagz.com/bookings/${bookingId}`
        }
    });

    if (!booking.ground.settings)
        throw new InternalServerError("Could not resolve settings associated with the booked ground.");

    if (booking.ground.settings.notificationsTrigger.includes(NotificationEvent.BOOKING_EXPIRED)) {
        // Check if the staff member is allowed to recieve booking notifications.
        await Promise.all(booking.pitch.staff.map(async (member) => {
            const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

            if (isAllowed) {
                if (!member.user.preferences)
                    throw new InternalServerError("Could not resolve user preferences associated with the user account.")

                await NotificationsService.createNotification({
                    phone: member.user.phone,
                    event: NotificationEvent.BOOKING_STARTED,
                    data: {
                        receiverName: member.user.firstName,
                        groundName: booking.ground.name,
                        pitchName: booking.pitch.name,
                        startTime: formatInTimeZone(booking.startTime, member.user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                        action: "marked as in progress",
                        deepLink: `https://www.hagz.com/dashboard/pitches/${booking.pitchId}/grounds/${booking.groundId}/bookings/${bookingId}`
                    }
                });
            }
        }));
    }
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