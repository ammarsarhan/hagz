import type { CreateStaffCheckoutBookingPayloadType, CreateStaffDirectBookingPayloadType, CreateUserBookingPayloadType, RescheduleUserBookingPayloadType } from "@/domains/bookings/bookings.validator.js";
import { BookingChannel, BookingStatus, GroundSize, GroundStatus, NotificationEvent, PaymentMethod, PermissionLevel, PitchStatus, PriceType, SlotStatus, UserRole, UserStatus } from "@/generated/prisma/enums.js";
import { BadRequestError, ERROR_CODES, ForbiddenError, InternalServerError, NotFoundError, UnauthorizedError } from "@/shared/lib/utils/error.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { splitTimeRangeIntoBlocks } from "@/shared/lib/utils/time.js";
import { addMinutes, differenceInHours, differenceInMilliseconds, startOfHour, subHours } from "date-fns";
import type { Booking, Ground, GroundSettings, GroundSlot, Pitch, PitchCustomer, User, UserPreferences } from "@/generated/prisma/client.js";
import NotificationsService from "@/domains/notifications/notifications.service.js";
import hasPermissions from "@/shared/lib/utils/permissions.js";
import type { Permissions } from "@/shared/types/staff.js";
import { bookingsQueue } from "@/jobs/queues/bookings.queue.js";
import { BookingEvent, formatUserBooking } from "@/shared/types/bookings.js";
import { formatInTimeZone } from "date-fns-tz";
import config from "@/shared/config.js";
import PaymentService from "@/domains/payments/payments.service.js";
import PitchService from "@/domains/pitches/services/pitches.service.js";

type MatchedUser = (User & { preferences: UserPreferences | null }) | null;

export default class BookingService {
    private readonly paymentService = new PaymentService();

    static readonly buildPricingSnapshot = (ground: Ground, settings: GroundSettings, slots: Array<GroundSlot>) => {
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

    // Was duplicated identically in createUserBooking, rescheduleUserBooking, and the
    // old createStaffBooking. One source of truth now.
    static readonly getGroundSizeMultiplier = (size: GroundSize) => {
        switch (size) {
            case GroundSize.FIVE_A_SIDE: return 5 * 2;
            case GroundSize.SEVEN_A_SIDE: return 7 * 2;
            case GroundSize.ELEVEN_A_SIDE: return 11 * 2;
            default: return 5 * 2;
        }
    };

    // Helper function that recieves a booking object and passes the appropriate jobs scheduled for the booking status.
    static readonly enqueueBookingLifecycle = async (booking: Booking, settings: GroundSettings) => {
        // If the booking has not been approved yet, set the approval expiry job.
        if (!booking.isApproved) {
            const approvalDelay = Math.max(0, differenceInMilliseconds(addMinutes(new Date(), settings.approvalExpiryLimit), new Date()));

            await bookingsQueue.add("approval",
                { bookingId: booking.id, event: BookingEvent.APPROVAL },
                { delay: approvalDelay, jobId: `bookings-${booking.id}-approval` }
            );
        };

        // If the booking has not been paid for yet (reserved but not confirmed), set the payment expiry job.
        if (booking.status === BookingStatus.RESERVED) {
            const paymentDelay = Math.max(0, differenceInMilliseconds(addMinutes(new Date(), settings.paymentExpiryLimit), new Date()));

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
        const inProgressDelay = Math.max(0, differenceInMilliseconds(booking.startTime, new Date()));
        await bookingsQueue.add("start",
            { bookingId: booking.id, event: BookingEvent.IN_PROGRESS },
            { delay: inProgressDelay, jobId: `bookings-${booking.id}-in_progress` }
        );

        const completeDelay = Math.max(0, differenceInMilliseconds(booking.endTime, new Date()));
        await bookingsQueue.add("end",
            { bookingId: booking.id, event: BookingEvent.COMPLETE },
            { delay: completeDelay, jobId: `bookings-${booking.id}-complete` }
        );
    };

    // Keep this as static because we want to be able to call it from the worker.
    static readonly dequeueBookingLifecycle = async (bookingId: string, event?: Omit<BookingEvent, "COMPLETE">) => {
        const jobId = `bookings-${bookingId}`;

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

    private resolveStaffBookingContext = async (
        initiatorId: string,
        pitchId: string,
        groundId: string,
        customerPayload: { phone: string; firstName?: string; lastName?: string }
    ) => {
        const pitch = await prisma.pitch.findUnique({
            where: { id: pitchId, status: { not: PitchStatus.DELETED } },
            include: { grounds: { where: { id: groundId } } }
        });

        if (!pitch)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (pitch.status === PitchStatus.MAINTENANCE)
            throw new BadRequestError("Pitch is temporarily unavailable. Please try again shortly.", ERROR_CODES.PITCH_UNDER_MAINTENANCE);

        if (pitch.status != PitchStatus.LIVE)
            throw new BadRequestError("Pitch is not live. Can not create booking on an inactive pitch.", ERROR_CODES.PITCH_NOT_LIVE);

        const ground = pitch.grounds.find(ground => ground.id === groundId);

        if (!ground)
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        if (ground.status != GroundStatus.ACTIVE)
            throw new BadRequestError("Ground is not active. Can not create booking on an inactive ground.", ERROR_CODES.GROUND_NOT_ACTIVE);

        const customer = await prisma.pitchCustomer.findUnique({
            where: { pitchId_phone: { phone: customerPayload.phone, pitchId } }
        });

        const hasRecord = !!customer;

        if (!hasRecord && (!customerPayload.firstName || !customerPayload.lastName))
            throw new BadRequestError("A customer account has not been found for the specified phone number on this pitch. Please specify a first name and last name to create the booking.", ERROR_CODES.VALIDATION_FAILED);

        const initiator = await prisma.user.findUnique({
            where: { id: initiatorId },
            include: { preferences: true }
        });

        if (initiator && initiator.phone === customerPayload.phone)
            throw new BadRequestError("A staff member may not create a booking for themselves through the dashboard. Please book through the standard user interface.", ERROR_CODES.VALIDATION_FAILED);

        const settings = await prisma.groundSettings.findUnique({ where: { groundId } });

        if (!settings)
            throw new InternalServerError("Could not resolve ground settings for the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);

        const match = await prisma.user.findUnique({
            where: { phone: customerPayload.phone, status: { not: UserStatus.DELETED } },
            include: { preferences: true }
        });

        if (!settings.allowGuestBookings && !match)
            throw new BadRequestError("Request booking must be for a customer with a registered user account.", ERROR_CODES.BOOKING_GUEST_NOT_ALLOWED);

        return { pitch, ground, settings, customer, hasRecord, match };
    };

    private commitStaffBooking = async (params: {
        pitch: Pitch;
        ground: Ground;
        settings: GroundSettings;
        hasRecord: boolean;
        customer: PitchCustomer | null;
        match: MatchedUser;
        pitchId: string;
        groundId: string;
        initiatorId: string;
        payload: {
            startTime: Date;
            endTime: Date;
            paymentMethod: PaymentMethod;
            channel: BookingChannel;
            customer: { phone: string; firstName?: string; lastName?: string };
        };
        status: typeof BookingStatus.RESERVED | typeof BookingStatus.CONFIRMED;
        applyServiceFee: boolean;
        applyDeposit: boolean;
    }) => {
        const { ground, settings, hasRecord, customer, match, pitchId, groundId, initiatorId, payload, status, applyServiceFee, applyDeposit } = params;

        const targetSlots = splitTimeRangeIntoBlocks(payload.startTime, payload.endTime);

        if (targetSlots.length < settings.minimumDuration || targetSlots.length > settings.maximumDuration)
            throw new BadRequestError(`Requested booking must be between ${settings.minimumDuration} and ${settings.maximumDuration} hours long.`, ERROR_CODES.BOOKING_DURATION_INVALID);

        if (differenceInHours(payload.startTime, new Date()) > settings.maximumWindow)
            throw new BadRequestError("Requested booking time must be less than the maximum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);

        return prisma.$transaction(async tx => {
            const targets = await tx.$queryRaw<{ id: string }[]>`
                SELECT id FROM "GroundSlot"
                WHERE "groundId" = ${groundId}
                AND "startsAt" = ANY(${targetSlots}::timestamptz[])
                ORDER BY id
                FOR UPDATE
            `;

            const slots = await tx.groundSlot.findMany({ where: { id: { in: targets.map(t => t.id) } } });

            if (slots.find(slot => slot.status === SlotStatus.BOOKED))
                throw new BadRequestError("One or more slots already been booked. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            if (slots.find(slot => slot.status === SlotStatus.INACTIVE))
                throw new BadRequestError("One or more slots are outside of the pitch's operating hours. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            if (slots.length !== targetSlots.length)
                throw new BadRequestError("One or more slots have already been booked or are outside the pitch's operating hours.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            const { pricingMap, pricingSnapshot } = BookingService.buildPricingSnapshot(ground, settings, slots);
            const baseAmount = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType], 0);

            const serviceFeeAmount = applyServiceFee
                ? slots.length * BookingService.getGroundSizeMultiplier(ground.size) * config.SERVICE_RATE
                : 0;

            const totalAmount = baseAmount + serviceFeeAmount;

            let depositFee: number | null = null;

            if (applyDeposit) {
                if (!settings.depositPercentage)
                    throw new InternalServerError("The ground allows deposits but has not set a deposit percentage value.", ERROR_CODES.GROUND_SETTINGS_INVALID);

                depositFee = totalAmount * (settings.depositPercentage / 100);
            };

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
                    bookerRole: UserRole.MANAGER,
                    startTime: payload.startTime,
                    endTime: payload.endTime,
                    paymentMethod: payload.paymentMethod,
                    pricingSnapshot,
                    totalAmount,
                    depositFee,
                    channel: payload.channel,
                    isApproved: true,
                    status
                }
            });

            if (status === BookingStatus.CONFIRMED) {
                await PitchService.updateWeeklyBookings(tx, pitchId, 1);
            }

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

            if (status === BookingStatus.CONFIRMED) {
                await PaymentService.recordBookingRevenue(tx, pitchId, booking.id, {
                    baseAmount,
                    serviceFee: serviceFeeAmount || undefined,
                    collectedViaPlatform: false,
                });
            }

            return { assignee, booking };
        });
    };

    private notifyStaffBookingCreated = async (
        pitch: Pitch,
        ground: Ground,
        settings: GroundSettings,
        booking: Booking,
        assignee: PitchCustomer,
        match: MatchedUser,
        fallbackFirstName?: string
    ) => {
        const receiverName = assignee.firstName ?? fallbackFirstName!;
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
        if (settings.notificationsTrigger.includes(NotificationEvent.BOOKING_RECEIVED)) {
            const staff = await prisma.staff.findMany({
                where: { pitchId: pitch.id },
                include: { user: { include: { preferences: true } } }
            });

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
    };

    createStaffCheckoutBooking = async (initiatorId: string, pitchId: string, groundId: string, payload: CreateStaffCheckoutBookingPayloadType) => {
        const { pitch, ground, settings, customer, hasRecord, match } =
            await this.resolveStaffBookingContext(initiatorId, pitchId, groundId, payload.customer);

        if (!settings.paymentMethods.includes(payload.paymentMethod))
            throw new BadRequestError("Requested booking must be paid for in one of the allowed payment methods.", ERROR_CODES.BOOKING_PAYMENT_METHOD_NOT_ALLOWED);

        if (differenceInHours(payload.startTime, new Date()) < settings.minimumWindow)
            throw new BadRequestError("Requested booking time must be greater than the minimum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);

        const { assignee, booking } = await this.commitStaffBooking({
            pitch, ground, settings, hasRecord, customer, match,
            pitchId, groundId, initiatorId, payload,
            status: BookingStatus.RESERVED,
            applyServiceFee: true,
            applyDeposit: settings.allowDeposit,
        });

        // TODO: wire PaymentService here. CARD/WALLET → paymentService.createIntention()
        // (Paymob redirect). CASH → a kiosk/reference intention (Fawry). Either way,
        // update the Payment row's transactionRef and return the real checkout payload.
        const checkout = null;

        await BookingService.enqueueBookingLifecycle(booking, settings);
        await this.notifyStaffBookingCreated(pitch, ground, settings, booking, assignee, match, payload.customer.firstName);

        return { booking, checkout };
    };

    createStaffDirectBooking = async (initiatorId: string, pitchId: string, groundId: string, payload: CreateStaffDirectBookingPayloadType) => {
        const { pitch, ground, settings, customer, hasRecord, match } =
            await this.resolveStaffBookingContext(initiatorId, pitchId, groundId, payload.customer);

        const { assignee, booking } = await this.commitStaffBooking({
            pitch, ground, settings, hasRecord, customer, match,
            pitchId, groundId, initiatorId, payload,
            status: BookingStatus.CONFIRMED,
            applyServiceFee: false,
            applyDeposit: false,
        });

        // TODO: wire PaymentService here. CASH → paymentService.recordCashFeeDebt(...).
        // CARD/WALLET → paymentService.logExternalPayment(..., payload.paymentNote).

        await BookingService.enqueueBookingLifecycle(booking, settings);
        await PitchService.enqueueWeeklyBookingExpiration(pitchId, booking.id);
        await this.notifyStaffBookingCreated(pitch, ground, settings, booking, assignee, match, payload.customer.firstName);

        return { booking, checkout: null };
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

        if (pitch.status === PitchStatus.MAINTENANCE)
            throw new BadRequestError("Pitch is temporarily unavailable. Please try again shortly.", ERROR_CODES.PITCH_UNDER_MAINTENANCE);

        if (pitch.status != PitchStatus.LIVE)
            throw new BadRequestError("Pitch is not live. Can not create booking on an inactive pitch.", ERROR_CODES.PITCH_NOT_LIVE);

        const ground = pitch.grounds.find(ground => ground.id === payload.groundId);

        if (!ground)
            throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        if (ground.status != GroundStatus.ACTIVE)
            throw new BadRequestError("Ground is not active. Can not create booking on an inactive ground.", ERROR_CODES.GROUND_NOT_ACTIVE);

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
            hasRecord = false;
        } else {
            hasRecord = true;
        };

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

        const { assignee, booking } = await prisma.$transaction(async tx => {
            // 1. Lock slots in a consistent order to prevent deadlocks.
            const targets = await tx.$queryRaw<{ id: string }[]>`
                SELECT id FROM "GroundSlot"
                WHERE "groundId" = ${payload.groundId}
                AND "startsAt" = ANY(${targetSlots}::timestamptz[])
                ORDER BY id
                FOR UPDATE
            `;

            // 2. Re-read full slot data now that they are locked and fresh.
            const slots = await tx.groundSlot.findMany({
                where: { id: { in: targets.map(t => t.id) } }
            });

            // 3. Validate on fresh locked data.
            if (slots.find(slot => slot.status === SlotStatus.BOOKED))
                throw new BadRequestError("One or more slots already been booked. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            if (slots.find(slot => slot.status === SlotStatus.INACTIVE))
                throw new BadRequestError("One or more slots are outside of the pitch's operating hours. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            if (slots.length !== targetSlots.length)
                throw new BadRequestError("One or more slots have already been booked or are outside the pitch's operating hours.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            // 4. Calculate the priceSnapshot and total.
            const { pricingMap, pricingSnapshot } = BookingService.buildPricingSnapshot(ground, settings, slots);

            const totalAmount = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType], 0)
                + (slots.length * BookingService.getGroundSizeMultiplier(ground.size) * config.SERVICE_RATE);

            let depositFee = null;

            if (allowDeposit) {
                if (!depositPercentage) throw new InternalServerError("The ground allows deposits but has not set a deposit percentage value.", ERROR_CODES.GROUND_SETTINGS_INVALID);

                const percentage = (depositPercentage / 100);
                depositFee = totalAmount * percentage;
            };

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
                    bookerRole: UserRole.USER,
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
        await BookingService.enqueueBookingLifecycle(booking, settings);

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

            await Promise.all(staff.map(async (member) => {
                const isAllowed = hasPermissions(member.permissions as Permissions, member.role, "bookings", PermissionLevel.READ);

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

    fetchUserBookings = async (userId: string, cursor?: string) => {
        const limit = 20;
        const take = limit + 1;

        const [
            bookings,
            // analytics
        ] = await Promise.all([
            prisma.booking.findMany({
                where: {
                    customer: { userId }
                },
                orderBy: {
                    startTime: 'desc'
                },
                include: {
                    ground: true,
                    pitch: true,
                    slots: true,
                    payment: true,
                    rescheduledFrom: true,
                    rescheduledTo: true,
                    cancellation: true
                },
                take,
                ...(cursor && {
                    cursor: { id: cursor },
                    skip: 1,
                }),
            }),
            prisma.booking.findMany({
                where: {
                    customer: { userId },
                },
                include: {
                    ground: true,
                    pitch: true,
                }
            })
        ]);

        const data = bookings.length > limit ? bookings.slice(0, -1) : bookings;
        const next = bookings.length > limit ? data[data.length - 1].id : null;

        return {
            bookings: formatUserBooking(data),
            cursor: next,
        };
    };

    cancelUserBooking = async (userId: string, bookingId: string) => {
        const user = await prisma.user.findFirst({
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

        const booking = await prisma.booking.findUnique({
            where: {
                id: bookingId
            },
            select: {
                pitchId: true,
                groundId: true,
                status: true,
                totalAmount: true,
                depositFee: true,
                startTime: true,
                createdAt: true,
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

            // Lock slots in consistent order to prevent deadlocks.
            const targets = slots.map(s => s.id).sort();
            for (const id of targets) {
                await tx.$queryRaw`
                    SELECT id FROM "GroundSlot" WHERE id = ${id} FOR UPDATE
                `;
            };

            // Update the actual booking record.
            const booking = await tx.booking.update({
                where: { id: bookingId },
                data: { status: BookingStatus.CANCELLED }
            });
            
            if (booking.status === BookingStatus.CONFIRMED) {
                await PaymentService.reverseBookingLedgerEntries(tx, booking.pitchId, bookingId, "Booking cancelled");
            };

            // If the booking was previously confirmed, decrement the weeklyBookings count.
            if (booking.status === BookingStatus.CONFIRMED && differenceInHours(new Date(), booking.createdAt) <= 168) {
                await PitchService.updateWeeklyBookings(tx, booking.pitchId, -1);
            };
            
            const targetDays = [...new Set(slots.map(slot => slot.startsAt.getUTCDay()))];

            const schedules = await tx.schedule.findMany({
                where: {
                    dayOfWeek: {
                        in: targetDays
                    },
                    groundId: booking.groundId
                }
            });

            for await (const slot of slots) {
                const targetDay = slot.startsAt.getUTCDay();
                const hour = slot.startsAt.getUTCHours();
                const bit = 1 << hour;

                const schedule = schedules.find(schedule => schedule.dayOfWeek === targetDay)!;

                const isAvailable = schedule.isActive && (() => {
                    const baseMask = Buffer.from(schedule.baseHours).readUIntBE(0, 3);
                    const peakMask = Buffer.from(schedule.peakHours).readUIntBE(0, 3);
                    const discountMask = Buffer.from(schedule.discountHours).readUIntBE(0, 3);

                    return (baseMask | peakMask | discountMask) & bit;
                })();

                if (isAvailable) {
                    const peakMask = Buffer.from(schedule!.peakHours).readUIntBE(0, 3);
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

            if (differenceInHours(booking.startTime, new Date()) <= settings.fullRefundWindow && differenceInHours(booking.startTime, new Date()) >= settings.partialRefundWindow)
                refundFee = refundFee * (settings.refundPercentage / 100);

            if (differenceInHours(booking.startTime, new Date()) <= settings.partialRefundWindow)
                refundFee = 0;

            // Todo: Initiate the actual refund process on Paymob.
        };

        await BookingService.dequeueBookingLifecycle(bookingId);
        await PitchService.dequeueWeeklyBookingExpiration(booking.pitchId, bookingId);

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

        if (!config.CANCELLABLE_STATES.includes(booking.status))
            throw new BadRequestError(`Could not cancel booking. Booking is ${booking.status.toLowerCase()}`, ERROR_CODES.BOOKING_TRANSITION_INVALID);

        if (booking.rescheduledTo !== null)
            throw new BadRequestError("Can not reschedule booking that has already been rescheduled.", ERROR_CODES.BOOKING_TRANSITION_INVALID);

        const { minimumDuration, maximumDuration, allowRescheduling, rescheduleLimit, minimumWindow, maximumWindow } = settings;

        if (!allowRescheduling)
            throw new BadRequestError("The specified ground does not allow rescheduling. Please cancel your booking and reserve another slot.", ERROR_CODES.GROUND_SETTINGS_FORBIDDEN);

        if (differenceInHours(booking.startTime, new Date()) < rescheduleLimit)
            throw new BadRequestError("The specified booking starts outside of the booking rescheduling window specified by the staff. Please cancel your booking and reserve another slot.", ERROR_CODES.GROUND_SETTINGS_FORBIDDEN);

        // Validate the new slot times before entering the transaction.
        const startTime = startOfHour(payload.startTime);
        const endTime = startOfHour(payload.endTime);

        const targetSlots = splitTimeRangeIntoBlocks(startTime, endTime);

        if (targetSlots.length < minimumDuration || targetSlots.length > maximumDuration)
            throw new BadRequestError(`Requested booking must be between ${minimumDuration} and ${maximumDuration} hours long.`, ERROR_CODES.BOOKING_DURATION_INVALID);

        if (differenceInHours(payload.startTime, new Date()) > maximumWindow)
            throw new BadRequestError("Requested booking time must be less than the maximum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);

        if (differenceInHours(payload.startTime, new Date()) < minimumWindow)
            throw new BadRequestError("Requested booking time must be more than the miniumum window provided in settings.", ERROR_CODES.BOOKING_WINDOW_INVALID);

        const updated = await prisma.$transaction(async tx => {
            // 1. Lock and release old slots in consistent order to prevent deadlocks.
            const previous = await tx.groundSlot.findMany({ where: { bookingId } });

            const previousTargets = previous.map(s => s.id).sort();
            for (const id of previousTargets) {
                await tx.$queryRaw`SELECT id FROM "GroundSlot" WHERE id = ${id} FOR UPDATE`;
            }

            // 2. Lock new slots in consistent order.
            const targets = await tx.$queryRaw<{ id: string }[]>`
                SELECT id FROM "GroundSlot"
                WHERE "groundId" = ${booking.groundId}
                AND "startsAt" = ANY(${targetSlots}::timestamptz[])
                ORDER BY id
                FOR UPDATE
            `;

            // 3. Re-read full new slot data now that they are locked and fresh.
            const slots = await tx.groundSlot.findMany({
                where: { id: { in: targets.map(item => item.id) } }
            });

            // 4. Validate new slots on fresh locked data.
            if (slots.find(slot => slot.status === SlotStatus.BOOKED))
                throw new BadRequestError("One or more slots already been booked. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            if (slots.find(slot => slot.status === SlotStatus.INACTIVE))
                throw new BadRequestError("One or more slots are outside of the pitch's operating hours. Please select another time.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            if (slots.length !== targetSlots.length)
                throw new BadRequestError("One or more slots have already been booked or are outside the pitch's operating hours.", ERROR_CODES.BOOKING_SLOTS_NOT_AVAILABLE);

            // 5. Count reschedules inside the transaction using tx to prevent a concurrent reschedule racing past the limit.
            let rescheduleCount = 0;
            let currentId = bookingId;

            while (true) {
                const rescheduling = await tx.rescheduling.findUnique({
                    where: { toId: currentId },
                    select: { fromId: true }
                });

                if (!rescheduling) break;

                rescheduleCount++;
                currentId = rescheduling.fromId;
            }

            if (rescheduleCount >= 3)
                throw new BadRequestError("Booking has been rescheduled the maximum number of times.", ERROR_CODES.BOOKING_RESCHEDULING_LIMIT_EXCEEDED);

            // 6. Release old slots back to available (or delete if outside schedule).
            const targetDays = [...new Set(previous.map(slot => slot.startsAt.getUTCDay()))];

            const schedules = await tx.schedule.findMany({
                where: { groundId: booking.groundId, dayOfWeek: { in: targetDays.map(d => d + 1) } }
            });

            for (const slot of previous) {
                const targetDay = slot.startsAt.getUTCDay() + 1;
                const hour = slot.startsAt.getUTCHours();
                const bit = 1 << hour;

                const schedule = schedules.find(s => s.dayOfWeek === targetDay);

                if (!schedule) {
                    await tx.groundSlot.delete({ where: { id: slot.id } });
                    continue;
                }

                const baseMask = Buffer.from(schedule.baseHours).readUIntBE(0, 3);
                const peakMask = Buffer.from(schedule.peakHours).readUIntBE(0, 3);
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

            // 7. Mark old booking as RESCHEDULED.
            await tx.booking.update({
                where: { id: bookingId },
                data: { status: BookingStatus.RESCHEDULED }
            });

            // If the old booking was confirmed and recent, decrement.
            if (booking.status === BookingStatus.CONFIRMED && differenceInHours(new Date(), booking.createdAt) <= 168) {
                await PitchService.updateWeeklyBookings(tx, booking.pitchId, -1);
            }

            // 8. Build new pricing for the new slots.
            const { pricingMap, pricingSnapshot } = BookingService.buildPricingSnapshot(booking.ground, settings, slots);

            const totalAmount = slots.reduce((sum, slot) => sum + pricingMap[slot.priceType], 0)
                + (slots.length * BookingService.getGroundSizeMultiplier(booking.ground.size) * config.SERVICE_RATE);

            // 9. Create the new booking, inheriting everything from the old one.
            const created = await tx.booking.create({
                data: {
                    pitchId: booking.ground.pitchId,
                    groundId: booking.groundId,
                    customerId: booking.customerId,
                    initiatorId: userId,
                    bookerRole: UserRole.USER,
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

            // If the new booking is confirmed, increment.
            if (created.status === BookingStatus.CONFIRMED) {
                await PitchService.updateWeeklyBookings(tx, booking.pitchId, 1);
            }

            // 10. Claim the new slots.
            await tx.groundSlot.updateMany({
                where: { id: { in: slots.map(s => s.id) } },
                data: { status: SlotStatus.BOOKED, bookingId: created.id }
            });

            // 11. Create the rescheduling link.
            await tx.rescheduling.create({
                data: {
                    fromId: bookingId,
                    toId: created.id,
                    userRole: UserRole.USER,
                    initiatorId: userId,
                    refundDelta: totalAmount - booking.totalAmount
                }
            });

            return created;
        });

        // Dequeue old booking lifecycle, enqueue new one.
        await BookingService.dequeueBookingLifecycle(bookingId);
        await BookingService.enqueueBookingLifecycle(updated, settings);

        // Dequeue old weekly expiration, enqueue new one if confirmed.
        await PitchService.dequeueWeeklyBookingExpiration(booking.pitchId, bookingId);
        if (updated.status === BookingStatus.CONFIRMED) {
            await PitchService.enqueueWeeklyBookingExpiration(booking.pitchId, updated.id);
        }

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
