// Map out all of the possible situations in which a user/manager/owner could create a booking for a ground/combination.
import { addMinutes, differenceInHours, eachHourOfInterval, isAfter, isBefore, subHours, subMinutes } from "date-fns";
import { BookingSource, Ground, GroundSettings, RecurrenceFrequency, Schedule } from "generated/prisma";

import { ResolvedSettings } from "@/utils/dashboard";
import prisma from "@/utils/prisma";
import { generateReferenceId } from "@/utils/token";

// In the case that an owner is trying to create a booking:
// As a base we need to compare the booking startDate and endDate against 6 checks.

// 1) Check the pitch status & settings:
// - Pitch status is LIVE
// - Automatic Bookings does not matter in this case because the owner/manager is the one creating it.
// - Check the minBookingHours
// - Check the maxBookingHours
// - Check if advanceBooking has been set (We can assume that this will always be greater than the cancellationGrace because of our validation).

// 2) Check the ground/combination status & settings:
// - Ground status is LIVE
// - Check the minBookingHours
// - Check the maxBookingHours
// - Check if advanceBooking has been set (We can assume that this will always be greater than the cancellationGrace because of our validation).
// - If this is a combination, get the associated grounds and check for each of them.

// 3) Check the pitch schedule:
// - Make sure that the pitch is open for the specified day.
// - Make sure that any schedule checks take into account any cases where day overlapping occurs.

// 4) Check the pitch schedule exceptions:
// - Make sure that a schedule exception does not override with the booking startDate - endDate.
// - Make sure that any schedule checks take into account any cases where day overlapping occurs.

// 5) Check the ground/combination schedule exceptions:
// - Make sure that a schedule exception does not override with the booking startDate - endDate.
// - Make sure that any schedule checks take into account any cases where day overlapping occurs.

// 6) Check that another booking does not overlap.

// Now that we have made sure/verified that the slot is empty, we need to check the email/phone the owner is creating the booking for.
// If the email/phone is associated with a user account already, send them an email/SMS to verify that this is not a malicious request.

// Now we need to calculate the booking price, given the information we have about peakHours and offPeakDiscounts.
// Now create the booking with the information.

// Once this is done, our booking will be created as PENDING.
// When the user approves/verifies the booking request, the booking will be updated to APPROVED, which is when the deposit/full fee can be paid as long as the expiryDate has not been hit.
// Upon payment, the callback URL will send a request to update the booking to CONFIRMED.

export interface CreateBookingPayload {
    pitchId: string;
    groundId?: string;
    combinationId?: string;
    startDate: Date;
    endDate: Date;
    source: BookingSource;
    issuerId: string;
    user: {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        notes?: string;
    };
    recurrence?: {
        frequency: RecurrenceFrequency;
        interval: number;
        byDay: Array<number>;
        endsAt: Date;
    };
    notes?: string;
};

const generateBookingServiceError = (target: string, message: string, code: number) => {
    return {
        success: false as const,
        error: {
            target,
            message,
            code
        }
    }
};

export function getBookingDeadlines(settings: ResolvedSettings, startDate: Date) {
    const now = new Date();
    const timeUntilStart = differenceInHours(startDate, now);

    if (timeUntilStart <= 0) {
        throw new Error("Cannot calculate deadlines for a past or immediate start date.");
    };

    const proximity = Math.pow(Math.min(1, Math.max(0, (24 - timeUntilStart) / 24)), 1.5);

    const approvalBase = settings.paymentDeadline + 1;
    const paymentBase = settings.paymentDeadline;
    const advanceBase = settings.advanceBooking;
    const cancellationBase = settings.cancellationGrace;

    const compression = 3;

    const approvalOffset = approvalBase - proximity * compression;
    const paymentOffset = paymentBase - proximity * (compression * 0.7);
    const advanceOffset = advanceBase;

    let approvalDeadline = subHours(startDate, approvalOffset);
    let paymentDeadline = subHours(startDate, paymentOffset);
    const advanceDeadline = subHours(startDate, advanceOffset);
    let cancellationDeadline = subHours(startDate, cancellationBase);

    // Enforce order and safety
    if (approvalDeadline >= paymentDeadline) approvalDeadline = subMinutes(paymentDeadline, 30);
    if (paymentDeadline >= advanceDeadline) paymentDeadline = subMinutes(advanceDeadline, 30);

    if (approvalDeadline <= now) approvalDeadline = addMinutes(now, 5);
    if (paymentDeadline <= approvalDeadline) paymentDeadline = addMinutes(approvalDeadline, 30);

    // If it’s before advanceDeadline (invalid), move it forward
    if (isBefore(cancellationDeadline, advanceDeadline)) {
        cancellationDeadline = addMinutes(advanceDeadline, 15);
    }

    // If it’s after startDate (invalid), pull it back
    if (isAfter(cancellationDeadline, startDate)) {
        cancellationDeadline = subMinutes(startDate, 15);
    }

    return {
        approvalDeadline,
        paymentDeadline,
        advanceDeadline,
        cancellationDeadline
    };
};

const calculateBookingHourPrice = (hour: number, schedule: Schedule, price: number, settings: ResolvedSettings) => {
    const isPeakHour = schedule.peakHours?.includes(hour);
    const isOffPeakHour = schedule.offPeakHours?.includes(hour);

    if (isPeakHour) {
        return price * (1 + settings.peakHourSurcharge / 100);
    };

    if (isOffPeakHour) {
        return price * (1 - settings.offPeakDiscount / 100);
    };

    return price;
};

type CheckBookingExceptionsPayload = Pick<CreateBookingPayload, "startDate" | "endDate" | "pitchId" | "combinationId"> & { grounds: Ground[] };

export async function checkBookingExceptions({ startDate, endDate, pitchId, combinationId, grounds } : CheckBookingExceptionsPayload) {
    // Check for the pitch first.
    const pitchException = await prisma.scheduleException.findFirst({ 
        where: {
            targetId: pitchId,
            target: "PITCH",
            startDate: { lte: endDate },
            endDate: { gte: startDate }
        }
    });

    if (pitchException) return pitchException;

    // Check for combination exceptions if a combinationId was provided.
    const combinationException = await prisma.scheduleException.findFirst({
        where: {
            targetId: combinationId,
            target: "COMBINATION",
            startDate: { lte: endDate },
            endDate: { gte: startDate }
        }
    });

    if (combinationException) return combinationException;

    // Check for ground exceptions.
    const groundException = await prisma.scheduleException.findFirst({
        where: {
            target: "GROUND",
            targetId: { in: grounds.map(g => g.id) },
            startDate: { lte: endDate },
            endDate: { gte: startDate }
        }
    });

    if (groundException) return groundException;

    return false;
};

type GroundType = Ground & { settings: GroundSettings };

export async function checkBookingAvailability(payload: Omit<CreateBookingPayload, "user">, settings: ResolvedSettings) {
    // Populate our grounds array with the data that we need to access and ensure that they all belong to the same pitchId.
    let grounds: GroundType[] = [];

    if (payload.groundId) {
        const ground = await prisma.ground.findFirst({
            where: { 
                id: payload.groundId,
                layout: { 
                    pitchId: payload.pitchId
                }
            },
            include: {
                settings: true
            }
        });

        if (!ground || !ground.settings) return generateBookingServiceError("groundId", "Could not find a ground with the specified ID. Please try again with a valid target.", 404);
        grounds = [ground as GroundType];
    }

    if (payload.combinationId) {
        const combination = await prisma.combination.findFirst({ 
            where: { 
                id: payload.combinationId,
                layout: {
                    pitchId: payload.pitchId
                }
            },
            select: { 
                grounds: {
                    include: { 
                        settings: true
                    }
                } 
            }
        });

        if (!combination) return generateBookingServiceError("combinationId", "Could not find a combination with the specified ID. Please try again with a valid target.", 404);
        grounds = combination.grounds as GroundType[];
    };

    // Check the status of both the pitch and the ground(s).
    const pitch = await prisma.pitch.findFirst({ 
        where: { 
            id: payload.pitchId, 
            status: { in: ["LIVE"] } 
        },
        include: {
            settings: true
        }
    });

    if (!pitch || !pitch.settings) return generateBookingServiceError("pitchId", "Could not find an active pitch with the specified ID. Please make sure this pitch is active and try again later.", 404);

    const inactiveGround = grounds.find(ground => ground.status != "LIVE");
    if (inactiveGround) return generateBookingServiceError("groundId", `Could not create a booking for ${inactiveGround.name}. It is currently inactive. Please try again later.`, 400);

    // Check if any current bookings exist on any of the grounds that overlap with the specified startDate and endDate.
    const overlappingBooking = await prisma.booking.findFirst({
        where: {
            status: { notIn: ["CANCELLED", "EXPIRED", "REJECTED"] },
            grounds: { some: { id: { in: grounds.map(g => g.id) } } },
            startDate: { lte: payload.endDate },
            endDate: { gte: payload.startDate }
        },
        include: {
            grounds: true
        }
    });

    if (overlappingBooking) {
        const names = overlappingBooking.grounds.map(g => g.name).join(", ");
        return generateBookingServiceError("startDate", `The selected time slot overlaps with an existing booking on ${names}. Please choose a different time.`, 409);
    };

    // Check if any schedule exceptions exist on any of the grounds, combination, or pitch.
    const exception = await checkBookingExceptions({ ...payload, grounds });
    if (exception) return generateBookingServiceError("startDate", `The selected time slot overlaps with an existing schedule exception on ${exception.target}. Please choose a different time.`, 409);

    // Check the pitch's schedule and make sure that it is open for each hour that the booking exists and calculate the price while doing so.
    let totalPrice: number = 0;
    let bookingDays: number[] = [];

    const bookingSegments = eachHourOfInterval({ start: payload.startDate, end: subMinutes(payload.endDate, 1) });

    bookingSegments.forEach(segment => {
        const day = segment.getDay();
        if (!bookingDays.includes(day)) bookingDays.push(day);
    });

    const schedules = await prisma.schedule.findMany({ 
        where: {
            pitchId: payload.pitchId,
            dayOfWeek: { in: bookingDays }
        }
    });

    if (!schedules) return generateBookingServiceError("pitchId", "Could not find the schedules associated with the specified pitchId. Please make sure schedules are set properly and try again. If this issue persists please get in touch with customer support.", 500);

    bookingSegments.forEach(segment => {
        const day = segment.getDay();
        const hour = segment.getHours();

        const schedule = schedules.find(s => s.dayOfWeek === day);
        if (!schedule) return generateBookingServiceError("startDate", "Could not find schedule for the specified startDate. Please try again later.", 500);
        if (hour < schedule.openTime || hour >= schedule.closeTime) return generateBookingServiceError("startDate", "The specified booking falls outside of the pitch's operating times. Please select a valid booking time.", 409);

        // Map through the grounds for each hour and add the peakHour/offPeakHour/defaultPrice to the total price.
        grounds.forEach(ground => {
            const price = ground.price ?? pitch.basePrice;
            const hourPrice = calculateBookingHourPrice(hour, schedule, price, settings);
            totalPrice += hourPrice;
        });
    });

    // Check if the booking is after the advanceDeadline.
    const now = new Date();
    const { approvalDeadline, paymentDeadline, cancellationDeadline, advanceDeadline } = getBookingDeadlines(settings, payload.startDate);
    if (isAfter(now, advanceDeadline)) return generateBookingServiceError("startDate", "Could not generate booking where advanceDeadline is before booking creation date.", 400);

    const bookingDuration = differenceInHours(payload.endDate, payload.startDate);
    const referenceId = generateReferenceId()

    return {
        success: true as const,
        data: {
            advanceDeadline,
            approvalDeadline,
            paymentDeadline,
            cancellationDeadline,
            referenceCode: referenceId,
            duration: bookingDuration,
            price: totalPrice
        }
    };
};

