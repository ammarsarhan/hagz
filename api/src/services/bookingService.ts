// Map out all of the possible situations in which a user/manager/owner could create a booking for a ground/combination.
// In the case that an owner is trying to create a booking:
// As a base we need to compare the booking startDate and endDate against 6 checks.

import { addHours, differenceInHours, differenceInMilliseconds, format, getDay, getHours, subHours } from "date-fns";
import { CombinationSettings, GroundSettings, PitchSettings } from "generated/prisma";
import { JsonValue } from "generated/prisma/runtime/library";

import prisma from "@/utils/prisma";
import { ResolvedSettings, unavailableStates } from "@/utils/booking";
import { bookingQueue } from "@/queues/booking";

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

type TargetSettings = Omit<GroundSettings, "id" | "createdAt" | "updatedAt" | "groundId"> | Omit<CombinationSettings, "id" | "createdAt" | "updatedAt" | "combinationId"> ;

export function resolveEffectiveSettings(targetSettings: TargetSettings, pitchSettings: PitchSettings): ResolvedSettings {
    return {
        minBookingHours: targetSettings.minBookingHours ?? pitchSettings.minBookingHours,
        maxBookingHours: targetSettings.maxBookingHours ?? pitchSettings.maxBookingHours,
        cancellationFee: targetSettings.cancellationFee ?? pitchSettings.cancellationFee,
        noShowFee: targetSettings.noShowFee ?? pitchSettings.noShowFee,
        advanceBooking: targetSettings.advanceBooking ?? pitchSettings.advanceBooking,
        paymentDeadline: targetSettings.paymentDeadline ?? pitchSettings.paymentDeadline,
        peakHourSurcharge: targetSettings.peakHourSurcharge ?? pitchSettings.peakHourSurcharge,
        offPeakDiscount: targetSettings.offPeakDiscount ?? pitchSettings.offPeakDiscount
    };
};

interface ResolveTargetsPayload {
    grounds: Array<{
        id: string,
        name: string,
        effectiveSettings: JsonValue
    }>,
    combinations: Array<{
        id: string,
        name: string,
        effectiveSettings: JsonValue
    }>
};

interface TargetType {
    id: string;
    name: string;
    type: "ALL" | "GROUND" | "COMBINATION";
    settings?: JsonValue
};

export function resolvePitchTargets(layout: ResolveTargetsPayload, settings: PitchSettings) {
    const targets: Array<TargetType> = [];

    targets.push({
        id: "ALL", 
        name: `All Grounds (${layout.grounds.length + layout.combinations.length})`,
        type: "ALL" as const
    });

    layout.grounds.forEach(g => {
        targets.push({
            id: g.id,
            name: g.name,
            type: "GROUND" as const,
            settings: {
                ...(g.effectiveSettings as Record<string, JsonValue>),
                cancellationGrace: settings.cancellationGrace
            }
        });
    });
    
    layout.combinations.forEach(c => {
        targets.push({
            id: c.id,
            name: c.name,
            type: "COMBINATION" as const,
            settings: {
                ...(c.effectiveSettings as Record<string, JsonValue>),
                cancellationGrace: settings.cancellationGrace
            }
        });
    });

    return targets;
};

export interface TimeSlot {
    startTime: Date;
    endTime: Date;
    available: boolean;
    price: number;
    isPeakHour: boolean;
    isOffPeakHour: boolean;
    reason?: string;
};

interface ResolveBookingDataPayload {
    account: {
        id: string;
        firstName: string;
        lastName: string;
        bookings: {
            startDate: Date;
            endDate: Date;
            grounds: {
                name: string;
            }[];
        }[];
    }
}

export function resolveLastBookingData({ account } : ResolveBookingDataPayload) {
    if (account.bookings.length === 0) return null;

    const booking = account.bookings[0];
    const duration = differenceInHours(booking.endDate, booking.startDate);

    let target = "";

    booking.grounds.forEach(
      (ground, index) => 
      index === booking.grounds.length - 1 ? 
      target += ground.name :
      target += `${ground.name} and `
    );

    return {
        startDate: booking.startDate,
        endDate: booking.endDate,
        target,
        duration
    };
};

interface AvailabilityCheck {
    available: boolean;
    reason?: string;
    conflictingBookings?: Array<{
        referenceCode: string;
        startTime: Date;
        endTime: Date;
    }>;
}

export async function checkTimeslotAvailability(id: string, targetId: string, targetType: "GROUND" | "COMBINATION", timeslots: Array<{ startTime: Date; endTime: Date }>): Promise<AvailabilityCheck> {
    const firstSlot = timeslots[0];
    const lastSlot = timeslots[timeslots.length - 1];
    const schedule = new Set<number>();

    timeslots.forEach(slot => {
        schedule.add(getDay(slot.startTime));
    });

    const pitch = await prisma.pitch.findUnique({ 
        where: {
            id,
            status: "LIVE"
        },
        select: {
            id: true,
            schedule: {
                where: {
                    dayOfWeek: {
                        in: Array.from(schedule)
                    }
                }
            },
            ...(targetType === "GROUND" && {
                layout: {
                    select: {
                        grounds: {
                            where: {
                                id: targetId,
                                status: "LIVE"
                            },
                            include: {
                                bookings: {
                                    where: {
                                        status: { in: unavailableStates },
                                        OR: [
                                            {
                                                startDate: {
                                                    gte: firstSlot.startTime,
                                                    lt: lastSlot.endTime
                                                }
                                            },
                                            {
                                                endDate: {
                                                    gt: firstSlot.startTime,
                                                    lte: lastSlot.endTime
                                                }
                                            },
                                            {
                                                AND: [
                                                    { startDate: { lte: firstSlot.startTime } },
                                                    { endDate: { gte: lastSlot.endTime } }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            ...(targetType === "COMBINATION" && {
                layout: {
                    select: {
                        combinations: {
                            where: {
                                id: targetId,
                            },
                            include: {
                                grounds: {
                                    where: {
                                        status: "LIVE"
                                    },
                                    include: {
                                        bookings: {
                                            where: {
                                                status: { in: unavailableStates },
                                                OR: [
                                                    {
                                                        startDate: {
                                                            gte: firstSlot.startTime,
                                                            lt: lastSlot.endTime
                                                        }
                                                    },
                                                    {
                                                        endDate: {
                                                            gt: firstSlot.startTime,
                                                            lte: lastSlot.endTime
                                                        }
                                                    },
                                                    {
                                                        AND: [
                                                            { startDate: { lte: firstSlot.startTime } },
                                                            { endDate: { gte: lastSlot.endTime } }
                                                        ]
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
        }
    });

    if (!pitch || !pitch.layout || !pitch.schedule) {
        return { 
            available: false, 
            reason: "Could not find details associated with the specified pitch. If this issue persists, please contact customer support." 
        };
    };

    const layout = pitch.layout as any;
    let targets: any[] = [];

    if (targetType === "GROUND") {
        const grounds = layout.grounds || [];

        if (grounds.length === 0) {
            return { 
                available: false, 
                reason: "Ground was not found or not live." 
            };
        };

        targets = grounds;
    } else {
        const combinations = layout.combinations || [];

        if (combinations.length === 0) {
            return { 
                available: false, 
                reason: "Combination was not found." 
            };
        };

        targets = combinations[0].grounds;
    }

    const exceptions = await prisma.scheduleException.findMany({
        where: {
            OR: [
                { target: "PITCH", targetId: id },
                { target: targetType, targetId: targetId }
            ],
            startDate: { lte: lastSlot.endTime },
            endDate: { gte: firstSlot.startTime }
        }
    });

    for (const slot of timeslots) {
        const dayOfWeek = getDay(slot.startTime);
        const startHour = getHours(slot.startTime);
        const endHour = getHours(slot.endTime);

        const schedule = pitch.schedule.find(s => s.dayOfWeek === dayOfWeek);

        if (!schedule) {
            return {
                available: false,
                reason: `No schedule found for ${format(slot.startTime, 'EEEE')}`
            };
        };

        if (schedule.openTime === 0 && schedule.closeTime === 0) {
            return {
                available: false,
                reason: `Pitch is closed on ${format(slot.startTime, 'EEEE')}`
            };
        };

        if (startHour < schedule.openTime || endHour > schedule.closeTime) {
            return {
                available: false,
                reason: `Timeslot ${format(slot.startTime, 'HH:mm')}-${format(slot.endTime, 'HH:mm')} is outside operating hours (${schedule.openTime}:00-${schedule.closeTime}:00)`
            };
        };

        const hasException = exceptions.find(ex => 
            slot.startTime >= ex.startDate && slot.startTime < ex.endDate
        );

        if (hasException) {
            return {
                available: false,
                reason: hasException.reason || `Maintenance scheduled for ${format(slot.startTime, 'MMM dd, HH:mm')}`
            };
        };

        const conflicts: Array<{
            referenceCode: string;
            startTime: Date;
            endTime: Date;
        }> = [];

        targets.forEach(ground => {
            ground.bookings.forEach((booking: any) => {
                const bookingStart = new Date(booking.startDate);
                const bookingEnd = new Date(booking.endDate);
                
                const hasOverlap = (
                    (slot.startTime >= bookingStart && slot.startTime < bookingEnd) ||
                    (slot.endTime > bookingStart && slot.endTime <= bookingEnd) ||
                    (slot.startTime <= bookingStart && slot.endTime >= bookingEnd)
                );

                if (hasOverlap) {
                    conflicts.push({
                        referenceCode: booking.referenceCode,
                        startTime: bookingStart,
                        endTime: bookingEnd
                    });
                }
            });
        });

        if (conflicts.length > 0) {
            const conflictDetails = conflicts.map(c => 
                `${format(c.startTime, 'HH:mm')}-${format(c.endTime, 'HH:mm')} (${c.referenceCode})`
            ).join(', ');

            return {
                available: false,
                reason: `Conflicting booking(s): ${conflictDetails}`,
                conflictingBookings: conflicts
            };
        }
    }

    return { available: true };
};

export async function calculateBookingPrice(pitchId: string, targetId: string, targetType: "GROUND" | "COMBINATION", timeslots: Array<{ startTime: Date; endTime: Date }>): Promise<number> {
    const days = new Set<number>();
    timeslots.forEach(slot => days.add(getDay(slot.startTime)));

    const pitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: {
        schedule: {
            where: {
                dayOfWeek: { in: Array.from(days) }
            }
        },
        layout: {
            select: {
                grounds: targetType === "GROUND" ? {
                    where: { id: targetId },
                    select: { price: true, effectiveSettings: true }
                } : undefined,
                combinations: targetType === "COMBINATION" ? {
                    where: { id: targetId },
                    select: { price: true, effectiveSettings: true }
                } : undefined
            }
        }
        }
    });

    if (!pitch?.layout) return 0;

    const layout = pitch.layout as any;
    const target = targetType === "GROUND" 
        ? layout.grounds?.[0] 
        : layout.combinations?.[0];

    if (!target) return 0;

    const basePrice = target.price;
    const settings = target.effectiveSettings;

    let totalPrice = 0;

    timeslots.forEach(slot => {
        const dayOfWeek = getDay(slot.startTime);
        const hour = getHours(slot.startTime);
        const schedule = pitch.schedule.find(s => s.dayOfWeek === dayOfWeek);

        if (!schedule) return;

        let price = basePrice + 15;

        if (schedule.peakHours.includes(hour)) {
            price += (price * settings.peakHourSurcharge) / 100;
        } else if (schedule.offPeakHours.includes(hour)) {
            price -= (price * settings.offPeakDiscount) / 100;
        }

        totalPrice += price;
    });

    return Math.round(totalPrice);
};

export function scheduleBookingJobs(id: string, isUser: boolean, isPaid: boolean, startDate: Date, endDate: Date, settings: ResolvedSettings) {
    const now = new Date();

    // We have 4 different cases:
    // 1) The owner is booking for a user, in that case we start off as an UNAPPROVED booking -> APPROVED by user -> PENDING payment -> CONFIRMED payment -> booking IN PROGRESS -> booking COMPLETED.
    // 2) The owner is booking for a user, in that case we start off as an UNAPPROVED booking -> APPROVED by user -> Booking is already paid or will be paid in cash (CONFIRMED) -> booking IN PROGRESS -> booking COMPLETED.
    // 3) The owner is booking for a guest, in that case we start off as a PENDING booking -> CONFIRMED payment -> booking IN PROGRESS -> booking COMPLETED.
    // 4) The owner is booking for a guest and they have already paid, start off as a CONFIRMED payment -> booking IN PROGRESS -> booking COMPLETED.

    if (isUser && !isPaid) {
        // Approval must happen 30 minutes before the payment deadline.
        const approvalFactor = settings.paymentDeadline + 0.5;
        const approvalDeadline = subHours(startDate, approvalFactor);

        bookingQueue.add("approval", { id }, { delay: differenceInMilliseconds(approvalDeadline, now) });

        // Payment must happen before the booking startDate by the settings.paymentDeadline factor.
        const paymentFactor = settings.paymentDeadline;
        const paymentDeadline = subHours(startDate, paymentFactor);
        bookingQueue.add("payment", { id }, { delay: differenceInMilliseconds(paymentDeadline, now) });
    };

    if (isUser && isPaid) {
        // Approval must happen 30 minutes before the advanceBooking deadline.
        const approvalFactor = settings.advanceBooking + 0.5;
        const approvalDeadline = subHours(startDate, approvalFactor);

        bookingQueue.add("approval", { id }, { delay: differenceInMilliseconds(approvalDeadline, now) });

        // Payment has already been completed so there is no need to add a paymentDeadline job.
    };

    if (!isUser && !isPaid) {
        // There is no approval factor because we are booking for a guest.
        // Payment must happen before the booking startDate by the settings.paymentDeadline factor.
        const paymentFactor = settings.paymentDeadline;
        const paymentDeadline = subHours(startDate, paymentFactor);
        bookingQueue.add("payment", { id }, { delay: differenceInMilliseconds(paymentDeadline, now) });
    };

    bookingQueue.add("start", { id }, { delay: differenceInMilliseconds(startDate, now) });
    bookingQueue.add("end", { id }, { delay: differenceInMilliseconds(endDate, now) });
};
