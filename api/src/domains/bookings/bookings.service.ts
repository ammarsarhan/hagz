import type { CreateStaffBookingPayloadType, CreateUserBookingPayloadType } from "@/domains/bookings/bookings.validator.js";
import { BookingActor, BookingChannel, BookingStatus, GroundActions, GroundStatus, NotificationEvent, PaymentMethod, PermissionLevel, PitchStatus, SlotStatus, UserStatus } from "@/generated/prisma/enums.js";
import { BadRequestError, ERROR_CODES, ForbiddenError, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";
import config from "@/shared/config.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { splitTimeRangeIntoBlocks } from "@/shared/lib/utils/time.js";
import { differenceInHours, startOfHour } from "date-fns";
import type { Booking, Ground, GroundSettings, GroundSlot } from "@/generated/prisma/client.js";
import NotificationsService, { type CreateNotificationPayload } from "@/domains/notifications/notifications.service.js";
import hasPermissions from "@/shared/lib/utils/permissions.js";
import type { Permissions } from "@/shared/types/staff.js";
import { bookingsQueue } from "@/jobs/queues/bookings.queue.js";
import { BookingEvent } from "@/shared/types/bookings.js";

export default class BookingService {
    private readonly notificationsService = new NotificationsService();

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
    private readonly enqueueBookingLifecycle = async (booking: Booking) => {
        await bookingsQueue.add("booking", { bookingId: booking.id, event: BookingEvent.APPROVAL });
        await bookingsQueue.add("booking", { bookingId: booking.id, event: BookingEvent.PAYMENT });
        await bookingsQueue.add("booking", { bookingId: booking.id, event: BookingEvent.IN_PROGRESS });
        await bookingsQueue.add("booking", { bookingId: booking.id, event: BookingEvent.COMPLETE });
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

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not create booking on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);

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

        const user = await prisma.user.findUnique({ where: { id: initiatorId }, select: { phone: true }});

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
            }}
        );

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
        const total = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType], 0);
        let deposit = null;

        // Check if we are placing a deposit or paying in full then calculate the deposit.
        if (payload.channel === BookingChannel.ONLINE && allowDeposit) {
            // If the owner has allowDeposit but no depositPercentage throw an error.
            if (!depositPercentage) throw new InternalServerError("The ground allows deposits but has not set a deposit percentage value.", ERROR_CODES.GROUND_SETTINGS_INVALID);

            const percentage = (depositPercentage / 100);
            deposit = total * percentage;
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
                    totalAmount: total,
                    depositFee: deposit,
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
                    total,
                    deposit,
                }
            });

            return { assignee, booking };
        });

        // Create the notification for the customer.
        const basePayload = {
            phone: payload.customer.phone,
            data: {
                recieverName: assignee.firstName ?? "",
                groundName: ground.name,
                pitchName: pitch.name,
                startTime: booking.startTime.toISOString(),
                deepLink: "https://www.hagz.com/booking/some-random-booking-id"
            }
        }

        const notificationPayload = 
            status === BookingStatus.RESERVED ? 
            {
                phone: basePayload.phone,
                event: NotificationEvent.BOOKING_RESERVED,
                data: { 
                    ...basePayload.data, 
                    action: "reserved. Payment is still required to confirm the spot" as const 
                }
            } : 
            {
                phone: basePayload.phone,
                event: NotificationEvent.BOOKING_CONFIRMED,
                data: { ...basePayload.data, action: "confirmed successfully" as const }
            };

        // Shoot the customer a notification.
        await this.notificationsService.createNotification(notificationPayload);

        // Enqueue the booking lifecycle events to be handled by the background worker.
        await this.enqueueBookingLifecycle(booking);

        // If we are dealing with an online booking, generate the payment link for them.
        if (payload.channel === BookingChannel.ONLINE) {
            // Generate payment intent link via Paymob (or whatever gateway).

            // Store the link/ref against the Payment record.
        }

        // Trigger notifications based on notificationsTrigger setting.
        if (notificationsTrigger.includes(GroundActions.BOOKED)) {
            // Create notification for the staff members.
            const staff = await prisma.staff.findMany({ 
                where: { pitchId }, 
                include: {
                    user: {
                        select: {
                            firstName: true,
                            phone: true
                        }
                    }
                }
            });

            // Check if the staff member is allowed to recieve booking notifications.
            staff.forEach(async (member) => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

                // Update the payload to accept the staff member's first name.
                if (isAllowed) {
                    await this.notificationsService.createNotification({
                        ...notificationPayload,
                        phone: member.user.phone,
                        data: {
                            ...notificationPayload.data,
                            recieverName: member.user.firstName,
                        }
                    } as CreateNotificationPayload);
                }
            });
        };

        return booking;
    };   
    
    createUserBooking = async (userId: string, phone: string, payload: CreateUserBookingPayloadType) => {
        // Ensure that the user has not been suspended/banned already and is verified and allowed to book.
        const user = await prisma.user.findUnique({ 
            where: { 
                id: userId, 
                status: { not: UserStatus.DELETED },
            }, 
            select: { 
                firstName: true, 
                lastName: true, 
                status: true 
            } 
        });

        if (!user || user.status != UserStatus.ACTIVE)
            throw new ForbiddenError("Can not create booking for user. User account is not active.", ERROR_CODES.USER_NOT_ACTIVE);

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

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not create booking on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);

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
        const total = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType], 0);
        let deposit = null;

        // Check if we are placing a deposit or paying in full then calculate the deposit.
        if (allowDeposit) {
            // If the owner has allowDeposit but no depositPercentage throw an error.
            if (!depositPercentage) throw new InternalServerError("The ground allows deposits but has not set a deposit percentage value.", ERROR_CODES.GROUND_SETTINGS_INVALID);

            const percentage = (depositPercentage / 100);
            deposit = total * percentage;
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
                    totalAmount: total,
                    depositFee: deposit,
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
                    total,
                    deposit,
                }
            });

            return { assignee, booking };
        });

        // Create the notification for the user/booker.
        const notificationPayload = {
            phone,
            event: NotificationEvent.BOOKING_RESERVED,
            data: { 
                recieverName: assignee.firstName ?? "",
                groundName: ground.name,
                pitchName: pitch.name,
                startTime: booking.startTime.toISOString(),
                deepLink: "https://www.hagz.com/booking/some-random-booking-id",
                action: "reserved. Payment is still required to confirm the spot" as const 
            }
        };

        // Shoot the user a notification.
        await this.notificationsService.createNotification(notificationPayload);

        // Enqueue the booking lifecycle events to be handled by the background worker.
        await this.enqueueBookingLifecycle(booking);

        // Generate payment intent link via Paymob (or whatever gateway).

        // Store the link/ref against the Payment record.
            

        // Trigger notifications based on notificationsTrigger setting.
        if (notificationsTrigger.includes(GroundActions.BOOKED)) {
            // Create notification for the staff members.
            const staff = await prisma.staff.findMany({ 
                where: { pitchId: payload.pitchId }, 
                include: {
                    user: {
                        select: {
                            firstName: true,
                            phone: true
                        }
                    }
                }
            });

            // Check if the staff member is allowed to recieve booking notifications.
            staff.forEach(async (member) => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

                // Update the payload to accept the staff member's first name.
                if (isAllowed) {
                    await this.notificationsService.createNotification({
                        ...notificationPayload,
                        phone: member.user.phone,
                        data: {
                            ...notificationPayload.data,
                            recieverName: member.user.firstName,
                        }
                    } as CreateNotificationPayload);
                }
            });
        };

        return booking;
    }
};
