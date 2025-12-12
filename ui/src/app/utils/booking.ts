import z from "zod";
import { addDays, addHours, addMonths, addWeeks, format, getDay, getHours, isSameDay, set } from "date-fns";
import { BookingTargetOption } from "@/app/context/useBookingContext";
import { BookingConstraints, IntervalType } from "@/app/utils/types/booking";
import { BillingMethod, PitchScheduleItem, ResolvedSettings } from "@/app/utils/types/pitch";

export const createBookingSchema = (settings: ResolvedSettings) => z.object({
    firstName: z.string("Please enter a valid first name.")
        .min(2, "First name must be at least 2 characters long.")
        .max(50, "First name must be 50 characters at most."),
    lastName: z.string("Please enter a valid last name.")
        .min(2, "Last name must be at least 2 characters long.")
        .max(50, "Last name must be 50 characters at most."),
    phone: z.string("Please enter a valid phone number.")
        .min(11, "Phone number must be exactly 11 characters.")
        .max(11, "Phone number must be exactly 11 characters."),
    selectedDate: z.date(),
    selectedTime: z.number("Selected time must be a valid hour.")
        .int("Selected time must be a valid integer.")
        .min(0, "Selected start time must be a valid number from 0 to 23")
        .max(23, "Selected start time must be a valid number from 0 to 23"),
    source: z.enum(["PLATFORM", "IN_PERSON", "PHONE", "OTHER"]),
    selectedTimeslots: z.array(
        z.number("Selected timeslot index must be a valid number")
        .min(0, "Selected timeslot index must be from 0 to 5.")
        .max(5, "Selected timeslot index must be from 0 to 5."),
        "Selected timeslots must be an unempty array."
    )
    .min(settings.minBookingHours, `Must have at least ${settings.minBookingHours} selected timeslot(s).`)
    .max(settings.maxBookingHours, `Must have at least ${settings.maxBookingHours} selected timeslot(s).`),
    isPaid: z.enum(["YES", "NO"]),
    paymentMethod: z.enum(["CASH", "CREDIT_CARD", "WALLET"]).nullable(),
    notes: z.string("Please enter a valid note about the booking.")
        .optional()
        .refine(val => !val || val.length === 0 || (val.length >= 2 && val.length <= 500), {
            error: "Phone number must be between 2 and 500 characters if provided."
        }),
    isRecurring: z.enum(["YES", "NO"]),
    recurringOptions: z.object({
        frequency: z.enum(["WEEKLY", "MONTHLY"], "Please use a valid frequency type."),
        interval: z.enum(["ONE_WEEK", "TWO_WEEK", "THREE_WEEK", "ONE_MONTH", "TWO_MONTH"], "Please use a valid interval type."),
        occurrences: z.number("Please enter a valid number of occurrences.")
            .min(2, "There must be at least 2 occurrences for a recurring booking.")
            .max(6, "You may create up to 6 recurring bookings at most."),
        endsAt: z.date(),
        payment: z.enum(["ONE_TIME", "PER_INSTANCE"])
    }).optional()
});

export const getFirstOpenDate = (closedDays: number[], startDate: Date = new Date()) => {
    let current = startDate;

    while (closedDays.includes(getDay(current))) {
        current = addDays(current, 1);
    };
    
    return current;
};

export const calculateRecurringEndDate = (
    startDate: Date,
    frequency: "WEEKLY" | "MONTHLY",
    interval: IntervalType,
    occurrences: number
): Date => {
    let endDate = new Date(startDate);
    const totalIntervals = occurrences - 1;

    if (frequency === "WEEKLY") {
        switch (interval) {
            case "ONE_WEEK":
                endDate = addWeeks(startDate, totalIntervals);
                break;
            case "TWO_WEEK":
                endDate = addWeeks(startDate, totalIntervals * 2);
                break;
            case "THREE_WEEK":
                endDate = addWeeks(startDate, totalIntervals * 3);
                break;
        }
    } else if (frequency === "MONTHLY") {
        switch (interval) {
            case "ONE_MONTH":
                endDate = addWeeks(startDate, totalIntervals * 4);
                break;
            case "TWO_MONTH":
                endDate = addWeeks(startDate, totalIntervals * 8);
                break;
        }
    }

    return endDate;
};

export const resolveRecurringDates = (
    startDate: Date,
    frequency: "WEEKLY" | "MONTHLY",
    interval: IntervalType,
    occurrences: number
): Date[] => {
    const dates: Date[] = [];
    
    dates.push(new Date(startDate));
    
    let intervalMultiplier: number;
    
    if (frequency === "WEEKLY") {
        switch (interval) {
            case "ONE_WEEK":
                intervalMultiplier = 1;
                break;
            case "TWO_WEEK":
                intervalMultiplier = 2;
                break;
            case "THREE_WEEK":
                intervalMultiplier = 3;
                break;
            default:
                intervalMultiplier = 1;
        }
        
        for (let i = 1; i < occurrences; i++) {
            const nextDate = addWeeks(startDate, i * intervalMultiplier);
            dates.push(nextDate);
        };
    } else if (frequency === "MONTHLY") {
        switch (interval) {
            case "ONE_MONTH":
                intervalMultiplier = 1;
                break;
            case "TWO_MONTH":
                intervalMultiplier = 2;
                break;
            default:
                intervalMultiplier = 1;
        }
        
        for (let i = 1; i < occurrences; i++) {
            const nextDate = addMonths(startDate, i * intervalMultiplier);
            dates.push(nextDate);
        };
    }
    
    return dates;
};

export function resolveBookingData(schedule: PitchScheduleItem[], target: BookingTargetOption, inputDate: Date, isPaid: "YES" | "NO", paymentMethod: BillingMethod | null, isUser: boolean) {
    // Determine base deadline.
    const usesAdvanceBooking = (isPaid === "NO" && paymentMethod === "CASH") || 
                                paymentMethod === null || 
                                isPaid === "YES";
    
    const baseDeadline = usesAdvanceBooking 
        ? target.settings.advanceBooking 
        : target.settings.paymentDeadline;
    
    // Handle adding the approval buffer and payment buffer along with the correct factor.
    const approvalBuffer = isUser ? 0.5 : 0;
    const paymentBuffer = (isPaid === "NO" && paymentMethod != "CASH") ? 0.5 : 0;
    const deadlineFactor = baseDeadline + approvalBuffer + paymentBuffer;
    const deadlineDate = addHours(new Date(), deadlineFactor);

    // Round the deadline date to the next available startTime.
    if (deadlineDate.getMinutes() > 0 || deadlineDate.getSeconds() > 0 || deadlineDate.getMilliseconds() > 0) {
        deadlineDate.setHours(deadlineDate.getHours() + 1);
    }

    deadlineDate.setMinutes(0, 0, 0);

    const date = deadlineDate;
    const time = getHours(date);
    const closedHours: Array<number> = [];

    const activeSchedule = schedule.find(item => item.dayOfWeek === getDay(inputDate))!;

    // Get the closedHours if the deadlineDate is the same day as the targetDay.
    if (isSameDay(inputDate, deadlineDate)) {
        for (let i = 0; i < 24; i++) {
            if (i < activeSchedule.openTime || i >= activeSchedule.closeTime) {
                closedHours.push(i);
                continue;
            };

            if (i < time) {
                closedHours.push(i);
            };
        };

        return {
            date,
            time,
            closedHours
        };
    } else {
        for (let i = 0; i < 24; i++) {
            if (i < activeSchedule.openTime || i >= activeSchedule.closeTime) {
                closedHours.push(i);
                continue;
            };
        };
    
        return {
            date: inputDate,
            time: activeSchedule.openTime,
            closedHours
        };
    };
};

export const getBookingConstraints = (
    target: BookingTargetOption,
    isPaid: "YES" | "NO",
    paymentMethod: BillingMethod | null,
    isUser: boolean
): BookingConstraints => {
    // Determine base deadline.
    const usesAdvanceBooking = (isPaid === "NO" && paymentMethod === "CASH") || 
                                paymentMethod === null || 
                                isPaid === "YES";
    
    const baseDeadline = usesAdvanceBooking 
        ? target.settings.advanceBooking 
        : target.settings.paymentDeadline;
    
    const baseDeadlineType = usesAdvanceBooking ? 'ADVANCE' : 'PAYMENT';
    
    // User approval buffer (30 minutes = 0.5 hours).
    const approvalBuffer = isUser ? 0.5 : 0;
    
    // Rounding buffer (always 30 minutes for all bookings to ensure clean hour boundaries).
    const paymentBuffer = (isPaid === "NO" && paymentMethod != "CASH") ? 0.5 : 0;
    
    // Calculate total.
    const totalHours = baseDeadline + approvalBuffer + paymentBuffer;
    
    // Calculate earliest booking time.
    const earliestBookingTime = addHours(new Date(), totalHours);
    
    // Build explanation.
    let explanation = '';
    
    if (baseDeadlineType === 'PAYMENT') {
        explanation = `Payment must be completed ${baseDeadline} ${baseDeadline === 1 ? 'hour' : 'hours'} before the booking`;
    } else {
        explanation = `Bookings must be made ${baseDeadline} ${baseDeadline === 1 ? 'hour' : 'hours'} in advance`;
    }
    
    if (approvalBuffer > 0) {
        explanation += `, with an extra 30 minutes for user approval`;
    };

    if (paymentBuffer > 0) {
        explanation += `, and an additional 30 minutes for payment`;
    };
    
    // Always mention the rounding buffer.
    explanation += `. Earliest available: ${format(earliestBookingTime, 'MMM d, h:mm a')}.`;
    
    return {
        totalHours,
        earliestBookingTime,
        components: {
            baseDeadline,
            baseDeadlineType,
            approvalBuffer,
            paymentBuffer
        },
        explanation
    };
};

export const buildDateTime = (date: Date, hour: number) => {
    return set(date, {
        hours: hour,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
    });
};
