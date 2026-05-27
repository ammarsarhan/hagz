import type { CreateStaffBookingPayloadType, CreateUserBookingPayloadType, RescheduleUserBookingPayloadType } from "@/domains/bookings/bookings.validator.js";
import { BookingActor, BookingChannel, BookingStatus, GroundSize, GroundStatus, NotificationEvent, PaymentMethod, PermissionLevel, PitchStatus, PriceType, SlotStatus, UserStatus } from "@/generated/prisma/enums.js";
import { BadRequestError, ERROR_CODES, ForbiddenError, InternalServerError, NotFoundError, UnauthorizedError } from "@/shared/lib/utils/error.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { splitTimeRangeIntoBlocks } from "@/shared/lib/utils/time.js";
import { addMinutes, differenceInHours, differenceInMilliseconds, startOfHour, subHours } from "date-fns";
import type { Booking, Ground, GroundSettings, GroundSlot } from "@/generated/prisma/client.js";
import NotificationsService from "@/domains/notifications/notifications.service.js";
import hasPermissions from "@/shared/lib/utils/permissions.js";
import type { Permissions } from "@/shared/types/staff.js";
import { bookingsQueue } from "@/jobs/queues/bookings.queue.js";
import { BookingEvent, formatUserBooking } from "@/shared/types/bookings.js";
import { formatInTimeZone } from "date-fns-tz";
import config from "@/shared/config.js";
import PaymentService from "@/domains/payments/payments.service.js";

export default class BookingService {
    private readonly paymentService = new PaymentService();

    private readonly buildPricingSnapshot = (ground: Ground, settings: GroundSettings, slots: Array<GroundSlot>) => {
        const pricingMap = {
            BASE: ground.basePrice,
            PEAK: ground.peakPrice ?? ground.basePrice,
            DISCOUNT: ground.discountPrice ?? ground.basePrice
        };

        const pricingSnapshot = {
            basePrice: ground.basePrice,
            peakPrice: ground.peakPrice,
            discountPrice: ground.discountPrice,
            allowDeposit: settings.allowDeposit,
            depositPercentage: settings.depositPercentage,
            slots: slots.map(slot => ({
                startsAt: slot.startsAt,
                priceType: slot.priceType,
                price: pricingMap[slot.priceType]
            })),
        };

        return { pricingMap, pricingSnapshot };
    };

    // Helper function that recieves a booking object and passes the appropriate jobs scheduled for the booking status.
    private readonly enqueueBookingLifecycle = async (booking: Booking, settings: GroundSettings) => {
        // If the booking has not been approved yet, set the approval expiry job.
        if (!booking.isApproved) {
            const approvalDelay =  Math.max(0, addMinutes(new Date(), settings.approvalExpiryLimit).getTime() - Date.now());

            await bookingsQueue.add("approval", 
                { bookingId: booking.id, event: BookingEvent.APPROVAL }, 
                { delay: approvalDelay, jobId: `bookings-${booking.id}-approval` }
            );
        };

        // If the booking has not been paid for yet (reserved but not confirmed), set the payment expiry job.
        if (booking.status === BookingStatus.RESERVED) {
            const paymentDelay = Math.max(0, addMinutes(new Date(), settings.paymentExpiryLimit).getTime() - Date.now());

            await bookingsQueue.add("payment", 
                { bookingId: booking.id, event: BookingEvent.PAYMENT }, 
                { delay: paymentDelay, jobId: `bookings-${booking.id}-payment` }
            );
        };

        // Set a reminder 2 hours before the booking if we are booking more than 2 hours prior to the startTime.
        if (differenceInMilliseconds(subHours(booking.startTime, 2), new Date()) > 0) {
            const reminderDelay = differenceInMilliseconds(subHours(booking.startTime, 2), new Date());

            await bookingsQueue.add("reminder",
                { bookingId: booking.id, event: BookingEvent.REMINDER },
                { delay: reminderDelay, jobId: `bookings-${booking.id}-reminder` }
            );
        };

        // Regardless of the status, bookings need to pass by both the IN_PROGRESS and COMPLETE handlers.
        const inProgressDelay =  Math.max(0, new Date(booking.startTime).getTime() - Date.now());
        await bookingsQueue.add("start", 
            { bookingId: booking.id, event: BookingEvent.IN_PROGRESS }, 
            { delay: inProgressDelay, jobId: `bookings-${booking.id}-in_progress` }
        );

        const completeDelay =  Math.max(0, new Date(booking.endTime).getTime() - Date.now());
        await bookingsQueue.add("end", 
            { bookingId: booking.id, event: BookingEvent.COMPLETE }, 
            { delay: completeDelay, jobId: `bookings-${booking.id}-complete` }
        );
    };

    // Keep this as static because we want to be able to call it from the worker.
    static readonly dequeueBookingLifecycle = async (bookingId: string, event?: Omit<BookingEvent, "COMPLETE">) => {
        const jobId = `bookings-${bookingId}`
        
        switch (event) {
            case BookingEvent.APPROVAL:
                {
                    await bookingsQueue.remove(`${jobId}-payment`);
                    await bookingsQueue.remove(`${jobId}-reminder`);
                    await bookingsQueue.remove(`${jobId}-in_progress`);
                    await bookingsQueue.remove(`${jobId}-complete`);
                    break;
                }
            case BookingEvent.PAYMENT:
                {
                    await bookingsQueue.remove(`${jobId}-reminder`);
                    await bookingsQueue.remove(`${jobId}-in_progress`);
                    await bookingsQueue.remove(`${jobId}-complete`);
                    break;
                }
            case BookingEvent.IN_PROGRESS:
                {
                    await bookingsQueue.remove(`${jobId}-complete`);
                    break;
                }
            default:
                {
                    await bookingsQueue.remove(`${jobId}-approval`);
                    await bookingsQueue.remove(`${jobId}-payment`);
                    await bookingsQueue.remove(`${jobId}-reminder`);
                    await bookingsQueue.remove(`${jobId}-in_progress`);
                    await bookingsQueue.remove(`${jobId}-complete`);
                }
        }
    };

    createStaffBooking = async (initiatorId: string, pitchId: string, groundId: string, payload: CreateStaffBookingPayloadType) => {
        // Check if a pitch exists and is in an active state first.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: { 
                grounds: { 
                    where: {
                        id: groundId,
                    }
                } 
            }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Ensure that the requestor knows that this is due to the pitch being under maintenance.
        if (pitch.status === PitchStatus.MAINTENANCE)
            throw new BadRequestError("Pitch is temporarily unavailable. Please try again shortly.", ERROR_CODES.PITCH_UNDER_MAINTENANCE);

        if (pitch.status != PitchStatus.LIVE)
            throw new BadRequestError("Pitch is not live. Can not create booking on an inactive pitch.", ERROR_CODES.PITCH_NOT_LIVE);

        // Then check if the ground exists and is in an active state.
        const ground = pitch.grounds.find(ground => ground.id === groundId);

        if (!ground)
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        if (ground.status != GroundStatus.ACTIVE)
            throw new BadRequestError("Ground is not active. Can not create booking on an inactive ground.", ERROR_CODES.GROUND_NOT_ACTIVE);

        // Check if a customer account already exists or not for the specified phone number and check if they are booking for themselves on their account.
        let hasRecord: boolean = false;
        
        const customer = await prisma.pitchCustomer.findUnique({
            where: {
                pitchId_phone: {
                    phone: payload.customer.phone,
                    pitchId
                }
            }
        });

        if (!customer) {
            // Set the flag to invoke to create function on booking creation for the customer record.
            hasRecord = false;

            // And if they do not exist and a first/last name was not provided, fail the request.
            if (!payload.customer.firstName || !payload.customer.lastName) 
                throw new BadRequestError("A customer account has not been found for the specified phone number on this pitch. Please specify a first name and last name to create the booking.", ERROR_CODES.VALIDATION_FAILED);
        } else {
            hasRecord = true;
        };

        const user = await prisma.user.findUnique({ 
            where: { id: initiatorId }, 
            include: { preferences: true }
        });

        if (user && user.phone === payload.customer.phone) 
            throw new BadRequestError("A staff member may not create a booking for themselves through the dashboard. Please book through the standard user interface.", ERROR_CODES.VALIDATION_FAILED);

        // Start validating the ground settings by fetching, comparing the required fields, and overriding the staff-set constraints for users.
        const settings = await prisma.groundSettings.findUnique({
            where: {
                groundId
            }
        });

        if (!settings)
            throw new InternalServerError("Could not resolve ground settings for the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);

        const { 
            minimumDuration, 
            maximumDuration, 
            minimumWindow, 
            maximumWindow, 
            paymentMethods, 
            allowDeposit, 
            allowGuestBookings,
            depositPercentage, 
            notificationsTrigger 
        } = settings;

        const match = await prisma.user.findUnique({ 
            where: { 
                phone: payload.customer.phone, 
                status: { not: UserStatus.DELETED }
            },
            include: {
                preferences: true
            }
        });

        if (!allowGuestBookings && !match)
            throw new BadRequestError("Request booking must be for a customer with a registered user account.", ERROR_CODES.BOOKING_GUEST_NOT_ALLOWED);

        const targetSlots = splitTimeRangeIntoBlocks(payload.startTime, payload.endTime);

        // The staff will still be subject to the minimum duration and maximum duration they have chosen in the settings.
        if (targetSlots.length < minimumDuration || targetSlots.length > maximumDuration)
            throw new BadRequestError(`Requested booking must be between ${minimumDuration} and ${maximumDuration} hours long.`, ERROR_CODES.BOOKING_DURATION_INVALID);

        // If we are booking for a walk-in or online, both channels should be subject to the maximumWindow constraint.
        if (differenceInHours(payload.startTime, new Date()) > maximumWindow)
            throw new BadRequestError("Requested booking time must be less than the maximum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);

        // We can assume that it is confirmed if the booking is a walk-in and not subject it to maximumWindow.
        let status: BookingStatus = BookingStatus.RESERVED;

        if (payload.channel === BookingChannel.WALK_IN) { 
            status = BookingStatus.CONFIRMED;

            // If we are booking for a walk-in, don't allow any payment methods other than cash.
            if (payload.paymentMethod !== PaymentMethod.CASH)
                throw new BadRequestError("Requested booking must be paid for in cash for a walk-in.", ERROR_CODES.BOOKING_PAYMENT_METHOD_NOT_ALLOWED);
        }
        else if (payload.channel === BookingChannel.ONLINE) {
            // If we are paying online, then the booking is reserved until the payment is confirmed.
            status = BookingStatus.RESERVED;
            
            // And if this is an online booking, we need the payment method to be allowed by the platform for the ground.
            if (!paymentMethods.includes(payload.paymentMethod))
                throw new BadRequestError("Requested booking must be paid for in one of the allowed payment methods.", ERROR_CODES.BOOKING_PAYMENT_METHOD_NOT_ALLOWED);

            // And it must follow the minimumWindow set to allow the customer enough time to pay.
            if (differenceInHours(payload.startTime, new Date()) < minimumWindow)
                throw new BadRequestError("Requested booking time must be greater than the minimum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);
        };

        // Query the slots as the final step and check if all of the slots are available.
        const slots = await prisma.groundSlot.findMany({
            where: {
                groundId,
                startsAt: { in: targetSlots },
            }
        });

        if (slots.find(slot => slot.status === SlotStatus.BOOKED))
            throw new BadRequestError("One or more slots already been booked. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        if (slots.find(slot => slot.status === SlotStatus.INACTIVE))
            throw new BadRequestError("One or more slots are outside of the pitch's operating hours. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        if (slots.length !== targetSlots.length) 
            throw new BadRequestError("One or more slots have already been booked or are outside the pitch's operating hours.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        // Calculate the priceSnapshot and total.
        const { pricingMap, pricingSnapshot } = this.buildPricingSnapshot(ground, settings, slots);
        let totalAmount = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType], 0);

        // And add into the price the user's service fee if the channel is online.
        if (payload.channel === BookingChannel.ONLINE) {
            let groundSize = 5 * 2;
    
            switch (ground.size) {
                case GroundSize.FIVE_A_SIDE:
                    groundSize = 5 * 2;
                    break;
                case GroundSize.SEVEN_A_SIDE:
                    groundSize = 7 * 2;
                    break;
                case GroundSize.ELEVEN_A_SIDE:
                    groundSize = 11 * 2;
                    break;
                default:
                    groundSize = 5 * 2;
                    break;
            }

            totalAmount = totalAmount + (slots.length * groundSize * config.SERVICE_RATE);
        }

        let depositFee = null;

        // Check if we are placing a deposit or paying in full then calculate the deposit.
        if (payload.channel === BookingChannel.ONLINE && allowDeposit) {
            // If the owner has allowDeposit but no depositPercentage throw an error.
            if (!depositPercentage) throw new InternalServerError("The ground allows deposits but has not set a deposit percentage value.", ERROR_CODES.GROUND_SETTINGS_INVALID);

            const percentage = (depositPercentage / 100);
            depositFee = totalAmount * percentage;
        };

        const { assignee, booking } = await prisma.$transaction(async tx => {
            const assignee = hasRecord ? customer! : await tx.pitchCustomer.create({
                data: {
                    pitchId,
                    userId: match?.id ?? null,
                    phone: payload.customer.phone,
                    firstName: payload.customer.firstName,
                    lastName: payload.customer.lastName,
                }
            });

            const booking = await tx.booking.create({
                data: {
                    pitchId,
                    groundId,
                    customerId: assignee.id,
                    initiatorId,
                    bookerRole: BookingActor.STAFF,
                    startTime: payload.startTime,
                    endTime: payload.endTime,
                    paymentMethod: payload.paymentMethod,
                    pricingSnapshot: pricingSnapshot,
                    totalAmount,
                    depositFee,
                    channel: payload.channel,
                    isApproved: true,
                    status
                }
            });

            await tx.groundSlot.updateMany({
                where: { id: { in: slots.map(s => s.id) } },
                data: { status: SlotStatus.BOOKED, bookingId: booking.id }
            });

            await tx.payment.create({
                data: {
                    bookingId: booking.id,
                    method: payload.paymentMethod,
                    totalAmount,
                    depositFee,
                }
            });

            return { assignee, booking };
        });

        let checkout = null;

        // If we are dealing with an online booking, generate the payment link for them.
        if (payload.channel === BookingChannel.ONLINE) {

            // Generate payment intent link via Paymob (or whatever gateway).
            const intention = await this.paymentService.createIntention();

            // Store the link/ref against the Payment record.
            await prisma.payment.update({
                where: { bookingId: booking.id },
                data: { transactionRef: intention.transactionRef }
            });

            checkout = `https://accept.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY!}&clientSecret=${intention.clientSecret}`;
        }

        // Enqueue the booking lifecycle events to be handled by the background worker.
        await this.enqueueBookingLifecycle(booking, settings);

        // Create the notification for the customer and dispatch it.
        const receiverName = assignee.firstName ?? payload.customer.firstName!;

        // Timezone fallback can be improved in the future, but for now within Egypt's scope, this will suffice.
        const timezone = match?.preferences?.timezone ?? "Africa/Cairo";

        const notificationPayload = booking.status === BookingStatus.RESERVED ? {
            event: NotificationEvent.BOOKING_RESERVED,
            data: {
                receiverName,
                groundName: ground.name,
                pitchName: pitch.name,
                startTime: formatInTimeZone(booking.startTime, timezone, "d-M-yyyy 'at' h aa"),
                action: "reserved. Payment is still required to confirm your spot" as const,
                deepLink: `https://www.hagz.com/booking/${booking.id}`
            }
        } : {
            event: NotificationEvent.BOOKING_CONFIRMED,
            data: {
                receiverName,
                groundName: ground.name,
                pitchName: pitch.name,
                startTime: formatInTimeZone(booking.startTime, timezone, "d-M-yyyy 'at' h aa"),
                action: "confirmed" as const,
                deepLink: `https://www.hagz.com/booking/${booking.id}`
            }
        };

        await NotificationsService.createNotification({
            phone: assignee.phone,
            ...notificationPayload
        });

        // Trigger notifications based on notificationsTrigger setting.
        if (notificationsTrigger.includes(NotificationEvent.BOOKING_RECEIVED)) {
            // Create notification for the staff members.
            const staff = await prisma.staff.findMany({ 
                where: { pitchId }, 
                include: {
                    user: {
                        include: {
                            preferences: true
                        }
                    }
                }
            });

            // Check if the staff member is allowed to recieve booking notifications.
            await Promise.all(staff.map(async (member) => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

                if (isAllowed) {
                    if (!member.user.preferences)
                        throw new InternalServerError("Could not resolve user preferences associated with the user account.")

                    await NotificationsService.createNotification({
                        phone: member.user.phone,
                        event: NotificationEvent.BOOKING_RECEIVED,
                        data: {
                            action: booking.status === BookingStatus.CONFIRMED ? "confirmed" : "reserved. Payment is still required to confirm the spot",
                            groundName: ground.name,
                            pitchName: pitch.name,
                            startTime: formatInTimeZone(booking.startTime, member.user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                            customerName: receiverName,
                            deepLink: `https://www.hagz.com/dashboard/pitches/${pitch.id}/grounds/${ground.id}/bookings/${booking.id}`
                        }
                    });
                }
            }));
        };

        return { booking, checkout };
    };   
    
    createUserBooking = async (userId: string, phone: string, payload: CreateUserBookingPayloadType) => {
        // Ensure that the user has not been suspended/banned already and is verified and allowed to book.
        const user = await prisma.user.findUnique({ 
            where: { 
                id: userId, 
                status: { not: UserStatus.DELETED },
            }, 
            include: {
                preferences: true
            }
        });

        if (!user || user.status != UserStatus.ACTIVE)
            throw new ForbiddenError("Can not create booking for user. User account is not active.", ERROR_CODES.USER_NOT_ACTIVE);

        if (!user.preferences)
            throw new InternalServerError("Could not resolve user preferences associated with the user account.", ERROR_CODES.USER_PREFERENCES_NOT_FOUND)

        // Check if a pitch exists and is in an active state first.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: payload.pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: { 
                grounds: { 
                    where: {
                        id: payload.groundId,
                    }
                } 
            }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Ensure that the requestor knows that this is due to the pitch being under maintenance.
        if (pitch.status === PitchStatus.MAINTENANCE)
            throw new BadRequestError("Pitch is temporarily unavailable. Please try again shortly.", ERROR_CODES.PITCH_UNDER_MAINTENANCE);

        if (pitch.status != PitchStatus.LIVE)
            throw new BadRequestError("Pitch is not live. Can not create booking on an inactive pitch.", ERROR_CODES.PITCH_NOT_LIVE);

        // Then check if the ground exists and is in an active state.
        const ground = pitch.grounds.find(ground => ground.id === payload.groundId);

        if (!ground)
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        if (ground.status != GroundStatus.ACTIVE)
            throw new BadRequestError("Ground is not active. Can not create booking on an inactive ground.", ERROR_CODES.GROUND_NOT_ACTIVE);

        // Check if a customer account already exists or not for the specified phone number and check if they are booking for themselves on their account.
        let hasRecord: boolean = false;
        
        const customer = await prisma.pitchCustomer.findUnique({
            where: {
                pitchId_phone: {
                    pitchId: payload.pitchId,
                    phone
                }
            }
        });

        if (!customer) {
            // Set the flag to invoke to create function on booking creation for the customer record.
            hasRecord = false;
        } else {
            hasRecord = true;
        };

        // Start validating the ground settings by fetching, comparing the required fields, and overriding the staff-set constraints for users.
        const settings = await prisma.groundSettings.findUnique({
            where: {
                groundId: payload.groundId
            }
        });

        if (!settings)
            throw new InternalServerError("Could not resolve ground settings for the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);

        const { 
            minimumDuration, 
            maximumDuration,
            minimumWindow,
            maximumWindow,
            paymentMethods,
            allowDeposit,
            depositPercentage,
            autoConfirm,
            notificationsTrigger
        } = settings;

        const startTime = startOfHour(payload.startTime);
        const endTime = startOfHour(payload.endTime);

        const targetSlots = splitTimeRangeIntoBlocks(startTime, endTime);

        // Booking must be within the minimum and maximum duration set by the staff in the settings.
        if (targetSlots.length < minimumDuration || targetSlots.length > maximumDuration)
            throw new BadRequestError(`Requested booking must be between ${minimumDuration} and ${maximumDuration} hours long.`, ERROR_CODES.BOOKING_DURATION_INVALID);

        // Booking must be subject to both the minimumWindow and maximumWindow for a user.
        if (differenceInHours(payload.startTime, new Date()) > maximumWindow)
            throw new BadRequestError("Requested booking time must be less than the maximum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);
        
        if (differenceInHours(payload.startTime, new Date()) < minimumWindow)
            throw new BadRequestError("Requested booking time must be more than the miniumum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);

        // Check if the selected payment method is within the allowed payment methods for this ground.
        if (!paymentMethods.includes(payload.paymentMethod))
            throw new BadRequestError("Requested booking must be paid for in one of the allowed payment methods.", ERROR_CODES.BOOKING_PAYMENT_METHOD_NOT_ALLOWED);
        
        // Query the slots as the final step and check if all of the slots are available.
        const slots = await prisma.groundSlot.findMany({
            where: {
                groundId: payload.groundId,
                startsAt: { in: targetSlots }
            }
        });

        if (slots.find(slot => slot.status === SlotStatus.BOOKED))
            throw new BadRequestError("One or more slots already been booked. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        if (slots.find(slot => slot.status === SlotStatus.INACTIVE))
            throw new BadRequestError("One or more slots are outside of the pitch's operating hours. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        if (slots.length !== targetSlots.length) 
            throw new BadRequestError("One or more slots have already been booked.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        // Calculate the priceSnapshot and total.
        const { pricingMap, pricingSnapshot } = this.buildPricingSnapshot(ground, settings, slots);

        // Resolve the groundSize to use it to calculate the user's service fee.
        let groundSize = 5 * 2;

        switch (ground.size) {
            case GroundSize.FIVE_A_SIDE:
                groundSize = 5 * 2;
                break;
            case GroundSize.SEVEN_A_SIDE:
                groundSize = 7 * 2;
                break;
            case GroundSize.ELEVEN_A_SIDE:
                groundSize = 11 * 2;
                break;
            default:
                groundSize = 5 * 2;
                break;
        }

        const totalAmount = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType], 0) + (slots.length * groundSize * config.SERVICE_RATE);
        let depositFee = null;

        // Check if we are placing a deposit or paying in full then calculate the deposit.
        if (allowDeposit) {
            // If the owner has allowDeposit but no depositPercentage throw an error.
            if (!depositPercentage) throw new InternalServerError("The ground allows deposits but has not set a deposit percentage value.", ERROR_CODES.GROUND_SETTINGS_INVALID);

            const percentage = (depositPercentage / 100);
            depositFee = totalAmount * percentage;
        };

        const { assignee, booking } = await prisma.$transaction(async tx => {
            const assignee = hasRecord ? customer! : await tx.pitchCustomer.create({
                data: {
                    userId,
                    pitchId: payload.pitchId,
                    phone: phone,
                    firstName: user.firstName,
                    lastName: user.lastName
                }
            });

            const booking = await tx.booking.create({
                data: {
                    pitchId: payload.pitchId,
                    groundId: payload.groundId,
                    customerId: assignee.id,
                    initiatorId: userId,
                    bookerRole: BookingActor.USER,
                    startTime: payload.startTime,
                    endTime: payload.endTime,
                    paymentMethod: payload.paymentMethod,
                    pricingSnapshot: pricingSnapshot,
                    totalAmount,
                    depositFee,
                    channel: BookingChannel.ONLINE,
                    isApproved: autoConfirm
                }
            });

            await tx.groundSlot.updateMany({
                where: { id: { in: slots.map(s => s.id) } },
                data: { status: SlotStatus.BOOKED, bookingId: booking.id }
            });

            await tx.payment.create({
                data: {
                    bookingId: booking.id,
                    method: payload.paymentMethod,
                    totalAmount,
                    depositFee,
                }
            });

            return { assignee, booking };
        });

        // Generate payment intent link via Paymob (or whatever gateway).
        const intention = await this.paymentService.createIntention();

        // Store the link/ref against the Payment record.
        await prisma.payment.update({
            where: { bookingId: booking.id },
            data: { transactionRef: intention.transactionRef }
        });

        const checkout = `https://accept.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY!}&clientSecret=${intention.clientSecret}`;

        // Enqueue the booking lifecycle events to be handled by the background worker.
        await this.enqueueBookingLifecycle(booking, settings);

        // Create the notification for the customer and dispatch it.
        await NotificationsService.createNotification({
            phone: assignee.phone,
            event: NotificationEvent.BOOKING_RESERVED,
            data: {
                receiverName: user.firstName,
                groundName: ground.name,
                pitchName: pitch.name,
                startTime: formatInTimeZone(booking.startTime, user.preferences?.timezone, "d-M-yyyy 'at' h aa"),
                action: "reserved. Payment is still required to confirm your spot",
                deepLink: `https://www.hagz.com/booking/${booking.id}`
            }
        });

        // Trigger notifications based on notificationsTrigger setting.
        if (notificationsTrigger.includes(NotificationEvent.BOOKING_RECEIVED)) {
            // Create notification for the staff members.
            const staff = await prisma.staff.findMany({ 
                where: { pitchId: payload.pitchId }, 
                include: {
                    user: {
                        include: {
                            preferences: true
                        }
                    }
                }
            });

            // Check if the staff member is allowed to recieve booking notifications.
            await Promise.all(staff.map(async (member) => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

                // Update the payload to accept the staff member's first name.
                if (isAllowed) {
                    if (!member.user.preferences)
                        throw new InternalServerError("Could not resolve user preferences associated with the user account.")

                    await NotificationsService.createNotification({
                        phone: member.user.phone,
                        event: NotificationEvent.BOOKING_RECEIVED,
                        data: {
                            action: "reserved. Payment is still required to confirm the spot",
                            groundName: ground.name,
                            pitchName: pitch.name,
                            startTime: formatInTimeZone(booking.startTime, member.user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                            customerName: user.firstName,
                            deepLink: `https://www.hagz.com/dashboard/pitches/${pitch.id}/grounds/${ground.id}/bookings/${booking.id}`
                        }
                    });
                }
            }));
        };

        return { booking, checkout };
    };

    fetchUserBooking = async (userId: string, bookingId: string) => {
        const booking = await prisma.booking.findUnique({ 
            where: {
                id: bookingId
            },
            include: {
                customer: {
                    select: {
                        userId: true
                    }
                },
                ground: true,
                pitch: true,
                slots: true,
                payment: true,
                rescheduledFrom: true,
                rescheduledTo: true,
                cancellation: true
            }
        });

        if (!booking)
            throw new NotFoundError("Could not find booking with the specified ID.", ERROR_CODES.BOOKING_NOT_FOUND);

        if (booking.customer.userId !== userId)
            throw new ForbiddenError("You are not authorized to access this resource.", ERROR_CODES.BOOKING_ACCESS_FORBIDDEN);

        return formatUserBooking([booking])[0];
    };

    fetchUserBookings = async (userId: string) => {
        const bookings = await prisma.booking.findMany({ 
            where: {
                customer: {
                    userId
                }
            },
            include: {
                ground: true,
                pitch: true,
                slots: true,
                payment: true,
                rescheduledFrom: true,
                rescheduledTo: true,
                cancellation: true
            }
        });

        return formatUserBooking(bookings);
    };

    cancelUserBooking = async (userId: string, bookingId: string) => {
        // Fetch the user data and make sure that they exist and are not deleted.
        const user = await prisma.user.findUnique({ 
            where: { 
                id: userId, 
                status: { not: UserStatus.DELETED } 
            },
            include: {
                preferences: true
            }
        });

        if (!user || !user.preferences)
            throw new UnauthorizedError("Could not find user record for the specified user ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        // Fetch the booking and ensure that the current state is allowed to cancel.
        const booking = await prisma.booking.findUnique({
            where: {
                id: bookingId
            },
            select: {
                groundId: true,
                status: true,
                totalAmount: true,
                depositFee: true,
                startTime: true,
                customer: {
                    select: {
                        userId: true
                    }
                },
                ground: {
                    include: {
                        pitch: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                    }
                }
            }
        });

        if (!booking)
            throw new NotFoundError("Could not find booking with the specified ID.", ERROR_CODES.BOOKING_NOT_FOUND);
        
        const settings = await prisma.groundSettings.findUnique({ where: { groundId: booking.groundId } });

        if (!settings)
            throw new InternalServerError("Could not resolve settings associated with the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);

        if (booking.customer.userId !== userId)
            throw new ForbiddenError("You are not authorized to access this resource.", ERROR_CODES.BOOKING_ACCESS_FORBIDDEN);

        // The user should only be allowed to cancel a booking that has not been paid for, or has been paid for and is still upcoming.
        if (!config.CANCELLABLE_STATES.includes(booking.status))
            throw new BadRequestError(`Could not cancel booking. Booking is ${booking.status.toLowerCase()}`, ERROR_CODES.BOOKING_TRANSITION_INVALID);

        // Start the cancellation process - rabena yestor.
        const updated = await prisma.$transaction(async tx => {
            const slots = await tx.groundSlot.findMany({
                where: {
                    bookingId
                }
            });

            if (slots.length <= 0)
                throw new InternalServerError("Could not cancel booking. No associated ground slots were found.");

            // Loop through each of the slots and lock them to ensure nothing else edits them.
            for await (const slot of slots) {
                await tx.$queryRaw`
                    SELECT id FROM "GroundSlot" WHERE id = ${slot.id} FOR UPDATE
                `;
            };

            // Update the actual booking record.
            const booking = await tx.booking.update({
                where: { id: bookingId },
                data: { status: BookingStatus.CANCELLED }
            });

            // Fetch the slots for the target ground.
            const targetDays = [...new Set(slots.map(slot => slot.startsAt.getUTCDay()))];

            const schedules = await tx.schedule.findMany({ 
                where: {
                    dayOfWeek: {
                        in: targetDays
                    },
                    groundId: booking.groundId
                }
            });

            // Loop through each of the slots to check the schedule for the associated day and figure out what the slot should be set as.
            for await (const slot of slots) {
                const targetDay = slot.startsAt.getUTCDay();
                const hour = slot.startsAt.getUTCHours();
                const bit = 1 << hour;

                const schedule = schedules.find(schedule => schedule.dayOfWeek === targetDay)!;

                const isAvailable = schedule.isActive && (() => {
                    const baseMask     = Buffer.from(schedule.baseHours).readUIntBE(0, 3);
                    const peakMask     = Buffer.from(schedule.peakHours).readUIntBE(0, 3);
                    const discountMask = Buffer.from(schedule.discountHours).readUIntBE(0, 3);
                    
                    return (baseMask | peakMask | discountMask) & bit;
                })();

                if (isAvailable) {
                    const peakMask     = Buffer.from(schedule!.peakHours).readUIntBE(0, 3);
                    const discountMask = Buffer.from(schedule!.discountHours).readUIntBE(0, 3);

                    const priceType = (peakMask & bit) ? PriceType.PEAK
                                    : (discountMask & bit) ? PriceType.DISCOUNT
                                    : PriceType.BASE;

                    await tx.groundSlot.update({
                        where: { id: slot.id },
                        data: { status: SlotStatus.AVAILABLE, bookingId: null, priceType }
                    });
                } else {
                    await tx.groundSlot.delete({ where: { id: slot.id } });
                };
            };

            return booking;
        });

        // Calculate the refund if needed based on the original booking status and issue it based on the ground policy.
        if (booking.status === BookingStatus.CONFIRMED) {
            let refundFee = booking.depositFee ?? booking.totalAmount;

            // If we are greater than the fullRefundWindow, then keep the full refund fee as the amount.
            // If we are between the fullRefundWindow and partialRefundWindow, return the refundPercentage of the booking to the user.
            if (differenceInHours(booking.startTime, Date.now()) <= settings.fullRefundWindow && differenceInHours(booking.startTime, Date.now()) >= settings.partialRefundWindow)
                refundFee = refundFee * (settings.refundPercentage / 100);
            
            // If we are less than the partialRefundWindow, do not return any money to the user.
            if (differenceInHours(booking.startTime, Date.now()) <= settings.partialRefundWindow)
                refundFee = 0;

            // Todo: Initiate the actual refund process on Paymob.
        };

        // Dequeue the booking fron the bookingQueue and send out notifications to both the user and the staff members.
        await BookingService.dequeueBookingLifecycle(bookingId);

        await NotificationsService.createNotification({ 
            userId, 
            event: NotificationEvent.BOOKING_CANCELLED,
            data: {
                receiverName: user.firstName,
                pitchName: booking.ground.pitch.name,
                groundName: booking.ground.name,
                startTime: formatInTimeZone(booking.startTime, user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                action: "cancelled",
                deepLink: `https://www.hagz.com/bookings/${bookingId}`
                
            }
        });

        if (settings.notificationsTrigger.includes(NotificationEvent.BOOKING_CANCELLED)) {
            // Create notification for the staff members.
            const staff = await prisma.staff.findMany({ 
                where: { pitchId: booking.ground.pitchId }, 
                include: {
                    user: {
                        include: {
                            preferences: true
                        }
                    }
                }
            });

            // Check if the staff member is allowed to recieve booking notifications.
            await Promise.all(staff.map(async (member) => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

                if (isAllowed) {
                    if (!member.user.preferences)
                        throw new InternalServerError("Could not resolve user preferences associated with the user account.")

                    await NotificationsService.createNotification({
                        phone: member.user.phone,
                        event: NotificationEvent.BOOKING_CANCELLED,
                        data: {
                            receiverName: member.user.firstName,
                            pitchName: booking.ground.pitch.name,
                            groundName: booking.ground.name,
                            startTime: formatInTimeZone(booking.startTime, member.user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                            action: "cancelled",
                            deepLink: `https://www.hagz.com/dashboard/pitches/${booking.ground.pitch.id}/grounds/${booking.ground.id}/bookings/${bookingId}`
                        }
                    });
                }
            }));
        };

        return updated;
    };

    rescheduleUserBooking = async (userId: string, bookingId: string, payload: RescheduleUserBookingPayloadType) => {
        // Fetch the user data and make sure that they exist and are not deleted.
        const user = await prisma.user.findUnique({ 
            where: { 
                id: userId, 
                status: { not: UserStatus.DELETED } 
            },
            include: {
                preferences: true
            }
        });

        if (!user || !user.preferences)
            throw new UnauthorizedError("Could not find user record for the specified user ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        // Fetch the booking and ensure that the current state is allowed to cancel.
        const booking = await prisma.booking.findUnique({
            where: {
                id: bookingId
            },
            include: {
                ground: {
                    include: {
                        pitch: { 
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                customer: true,
                rescheduledFrom: true,
                rescheduledTo: true
            }
        });

        if (!booking)
            throw new NotFoundError("Could not find booking with the specified ID.", ERROR_CODES.BOOKING_NOT_FOUND);

        const settings = await prisma.groundSettings.findUnique({ where: { groundId: booking.groundId } });

        if (!settings)
            throw new InternalServerError("Could not resolve settings associated with the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);

        if (booking.customer.userId !== userId)
            throw new ForbiddenError("You are not authorized to access this resource.", ERROR_CODES.BOOKING_ACCESS_FORBIDDEN);

        // The user should only be allowed to reschedule a booking that has not been paid for, or has been paid for and is still upcoming.
        if (!config.CANCELLABLE_STATES.includes(booking.status))
            throw new BadRequestError(`Could not cancel booking. Booking is ${booking.status.toLowerCase()}`, ERROR_CODES.BOOKING_TRANSITION_INVALID);

        if (booking.rescheduledTo !== null)
            throw new BadRequestError("Can not reschedule booking that has already been rescheduled.", ERROR_CODES.BOOKING_TRANSITION_INVALID); // We should not hit this in theory but keep it as a safe-guard, msh haykhasar.

        // Make sure the ground allows rescheduling and the booking falls within the reschedulingLimit window.
        const { minimumDuration, maximumDuration, allowRescheduling, rescheduleLimit, minimumWindow, maximumWindow } = settings;

        if (!allowRescheduling)
            throw new BadRequestError("The specified ground does not allow rescheduling. Please cancel your booking and reserve another slot.", ERROR_CODES.GROUND_SETTINGS_FORBIDDEN);

        if (differenceInHours(booking.startTime, Date.now()) < rescheduleLimit) 
            throw new BadRequestError("The specified booking starts outside of the booking rescheduling window specified by the staff. Please cancel your booking and reserve another slot.", ERROR_CODES.GROUND_SETTINGS_FORBIDDEN);

        // Validate the new slots to be booked.
        const startTime = startOfHour(payload.startTime);
        const endTime = startOfHour(payload.endTime);

        const targetSlots = splitTimeRangeIntoBlocks(startTime, endTime);
        
        if (targetSlots.length < minimumDuration || targetSlots.length > maximumDuration)
            throw new BadRequestError(`Requested booking must be between ${minimumDuration} and ${maximumDuration} hours long.`, ERROR_CODES.BOOKING_DURATION_INVALID);
        
        if (differenceInHours(payload.startTime, new Date()) > maximumWindow)
            throw new BadRequestError("Requested booking time must be less than the maximum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);
        
        if (differenceInHours(payload.startTime, new Date()) < minimumWindow)
            throw new BadRequestError("Requested booking time must be more than the miniumum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);

        // Query the slots as the final step and check if all of the slots are available.
        const slots = await prisma.groundSlot.findMany({
            where: {
                groundId: booking.groundId,
                startsAt: { in: targetSlots },
            }
        });

        if (slots.find(slot => slot.status === SlotStatus.BOOKED))
            throw new BadRequestError("One or more slots already been booked. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        if (slots.find(slot => slot.status === SlotStatus.INACTIVE))
            throw new BadRequestError("One or more slots are outside of the pitch's operating hours. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        if (slots.length !== targetSlots.length) 
            throw new BadRequestError("One or more slots have already been booked or are outside the pitch's operating hours.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

        // Leave the most expensive query to the end. We need to loop through the chain of bookings and make sure rescheduling has not happened more than 3 times.
        let rescheduleCount = 0;
        let currentId = bookingId;

        while (true) {
            const rescheduling = await prisma.rescheduling.findUnique({
                where: { toId: currentId },
                select: { fromId: true }
            });

            if (!rescheduling) break;

            rescheduleCount = rescheduleCount + 1;
            currentId = rescheduling.fromId;
        }

        if (rescheduleCount >= 3)
            throw new BadRequestError("Booking has been rescheduled the maximum number of times.", ERROR_CODES.BOOKING_RESCHEDULING_LIMIT_EXCEEDED);

        const updated = await prisma.$transaction(async tx => {
            // Lock and release old slots (same logic as cancel).
            const oldSlots = await tx.groundSlot.findMany({ where: { bookingId } });

            for (const slot of oldSlots) {
                await tx.$queryRaw`SELECT id FROM "GroundSlot" WHERE id = ${slot.id} FOR UPDATE`;
            }

            const targetDays = [...new Set(oldSlots.map(slot => slot.startsAt.getUTCDay()))];
            const schedules = await tx.schedule.findMany({
                where: { groundId: booking.groundId, dayOfWeek: { in: targetDays } }
            });

            for (const slot of oldSlots) {
                const targetDay = slot.startsAt.getUTCDay();
                const hour = slot.startsAt.getUTCHours();
                const bit = 1 << hour;

                const schedule = schedules.find(s => s.dayOfWeek === targetDay);

                if (!schedule) {
                    await tx.groundSlot.delete({ where: { id: slot.id } });
                    continue;
                }

                const baseMask     = Buffer.from(schedule.baseHours).readUIntBE(0, 3);
                const peakMask     = Buffer.from(schedule.peakHours).readUIntBE(0, 3);
                const discountMask = Buffer.from(schedule.discountHours).readUIntBE(0, 3);

                const isAvailable = schedule.isActive && ((baseMask | peakMask | discountMask) & bit);

                if (isAvailable) {
                    const priceType = (peakMask & bit) ? PriceType.PEAK
                                    : (discountMask & bit) ? PriceType.DISCOUNT
                                    : PriceType.BASE;

                    await tx.groundSlot.update({
                        where: { id: slot.id },
                        data: { status: SlotStatus.AVAILABLE, bookingId: null, priceType }
                    });
                } else {
                    await tx.groundSlot.delete({ where: { id: slot.id } });
                }
            }

            // Mark old booking as RESCHEDULED.
            await tx.booking.update({
                where: { id: bookingId },
                data: { status: BookingStatus.RESCHEDULED }
            });

            // Build new pricing for the new slots.
            const { pricingMap, pricingSnapshot } = this.buildPricingSnapshot(booking.ground, settings, slots);

            // Resolve the groundSize to use it to calculate the user's service fee.
            let groundSize = 5 * 2;

            switch (booking.ground.size) {
                case GroundSize.FIVE_A_SIDE:
                    groundSize = 5 * 2;
                    break;
                case GroundSize.SEVEN_A_SIDE:
                    groundSize = 7 * 2;
                    break;
                case GroundSize.ELEVEN_A_SIDE:
                    groundSize = 11 * 2;
                    break;
                default:
                    groundSize = 5 * 2;
                    break;
            }

            const totalAmount = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType], 0) + (slots.length * groundSize * config.SERVICE_RATE);

            // 4. Create the new booking, inheriting everything from the old one
            const created = await tx.booking.create({
                data: {
                    pitchId: booking.ground.pitchId,
                    groundId: booking.groundId,
                    customerId: booking.customerId,
                    initiatorId: userId,
                    bookerRole: BookingActor.USER,
                    startTime: payload.startTime,
                    endTime: payload.endTime,
                    paymentMethod: booking.paymentMethod,
                    pricingSnapshot,
                    totalAmount,
                    depositFee: booking.depositFee ? Math.round(totalAmount * (settings.depositPercentage! / 100)) : null,
                    channel: BookingChannel.ONLINE,
                    isApproved: booking.isApproved,
                    status: booking.status === BookingStatus.CONFIRMED ? BookingStatus.CONFIRMED : BookingStatus.RESERVED,
                }
            });

            // Claim the new slots with the new booking we just created.
            await tx.groundSlot.updateMany({
                where: { id: { in: slots.map(s => s.id) } },
                data: { status: SlotStatus.BOOKED, bookingId: created.id }
            });

            // Create the Rescheduling link.
            await tx.rescheduling.create({
                data: {
                    fromId: bookingId,
                    toId: created.id,
                    userRole: BookingActor.USER,
                    initiatorId: userId,
                    refundDelta: totalAmount - booking.totalAmount
                }
            });

            return created;
        });

        // Dequeue old booking lifecycle, enqueue new one.
        await BookingService.dequeueBookingLifecycle(bookingId);
        await this.enqueueBookingLifecycle(updated, settings);

        // Notify user that their booking has been rescheduled.
        await NotificationsService.createNotification({
            userId,
            event: NotificationEvent.BOOKING_RESCHEDULED,
            data: {
                receiverName: user.firstName,
                groundName: booking.ground.name,
                pitchName: booking.ground.pitch.name,
                fromDate: formatInTimeZone(booking.startTime, user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                toDate: formatInTimeZone(updated.startTime, user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                bookingArticle: "Your",
                deepLink: `https://www.hagz.com/bookings/${updated.id}`
            }
        });

        // Notify staff if trigger enabled.
        if (settings.notificationsTrigger.includes(NotificationEvent.BOOKING_RESCHEDULED)) {
            const staff = await prisma.staff.findMany({
                where: { pitchId: booking.ground.pitchId },
                include: { user: { include: { preferences: true } } }
            });

            await Promise.all(staff.map(async member => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);
                if (!isAllowed || !member.user.preferences) return;

                await NotificationsService.createNotification({
                    phone: member.user.phone,
                    event: NotificationEvent.BOOKING_RESCHEDULED,
                    data: {
                        receiverName: member.user.firstName,
                        groundName: booking.ground.name,
                        pitchName: booking.ground.pitch.name,
                        fromDate: formatInTimeZone(booking.startTime, member.user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                        toDate: formatInTimeZone(updated.startTime, member.user.preferences.timezone, "d-M-yyyy 'at' h aa"),
                        bookingArticle: "The",
                        deepLink: `https://www.hagz.com/dashboard/pitches/${booking.ground.pitchId}/grounds/${booking.groundId}/bookings/${updated.id}`
                    }
                });
            }));
        }

        return updated;
    };
};
