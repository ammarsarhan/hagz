import { BookingTargetOption } from "@/app/context/useBookingContext";
import { BillingMethod, BookingSource } from "@/app/utils/types/pitch";
import { addDays, addWeeks, addYears, endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek, subMonths, subWeeks, subYears } from "date-fns";

export type ViewType = "WEEKLY" | "LIST";
export type DateScopeType = "TODAY" | "TOMORROW" | "WEEK" | "NEXT_WEEK" | "MONTH" | "UPCOMING" | "PAST_WEEK" | "PAST_MONTH" | "ALL";

export type IntervalType = "ONE_WEEK" | "TWO_WEEK" | "THREE_WEEK" | "ONE_MONTH" | "TWO_MONTH";
export type PaymentType = "ONE_TIME" | "PER_INSTANCE";
export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CONFIRMED" | "CANCELLED" | "IN_PROGRESS" | "NO_SHOW" | "COMPLETED" | "EXPIRED";

export interface RecurringOptions {
    frequency: "WEEKLY" | "MONTHLY",
    interval: IntervalType,
    occurrences: number,
    endsAt: Date,
    payment: PaymentType
};

export interface BookingConstraints {
    totalHours: number;
    earliestBookingTime: Date;
    components: {
        baseDeadline: number;
        baseDeadlineType: 'ADVANCE' | 'PAYMENT';
        approvalBuffer: number;
        paymentBuffer: number;
    };
    explanation: string;
}

export interface CreateBookingState {
    bookingId: string | null;
    startedAt: Date | null;
    target: BookingTargetOption;
    selectedDate: Date;
    selectedTime: number;
    firstName: string,
    lastName: string,
    phone: string,
    source: BookingSource,
    selectedTimeslots: Array<number>,
    isPaid: "YES" | "NO",
    paymentMethod: BillingMethod | null,
    notes: string,
    isRecurring: "YES" | "NO",
    recurringOptions: RecurringOptions
};

export interface CreateBookingPayload {
    bookingId: string;
    startedAt: Date;
    target: string;
    targetType: "GROUND" | "COMBINATION",
    startDate: Date;
    timeslots: Array<{
        startTime: Date,
        endTime: Date
    }>;
    firstName: string;
    lastName: string;
    phone: string;
    source: BookingSource;
    paymentMethod: BillingMethod | null;
    notes: string;
    recurringOptions: RecurringOptions | null;
};

export function resolveScopeDates(scope: DateScopeType) {
    const now = new Date();
    const today = startOfDay(now);

    switch (scope) {
        case "TODAY":
            return {
                startDate: today,
                endDate: endOfDay(today)
            }
        case "TOMORROW":
            return {
                startDate: startOfDay(addDays(today, 1)),
                endDate: endOfDay(addDays(today, 1))
            }
        case "WEEK":
            return {
                startDate: startOfWeek(today),
                endDate: endOfWeek(today)
            }
        case "NEXT_WEEK":
            const nextWeekStart = addWeeks(startOfWeek(today), 1);
            return {
                startDate: nextWeekStart,
                endDate: endOfWeek(nextWeekStart)
            }
        case "MONTH":
            return {
                startDate: startOfMonth(today),
                endDate: endOfMonth(today)
            }
        case "UPCOMING":
            return {
                startDate: now,
                endDate: endOfDay(addYears(today, 1))
            }
        case "PAST_WEEK":
            const lastWeekStart = subWeeks(startOfWeek(today), 1);
            return {
                startDate: lastWeekStart,
                endDate: endOfWeek(lastWeekStart)
            }
        case "PAST_MONTH":
            const lastMonth = subMonths(today, 1);
            return {
                startDate: startOfMonth(lastMonth),
                endDate: endOfMonth(lastMonth)
            }
        case "ALL":
            return {
                startDate: subYears(today, 5),
                endDate: endOfDay(addYears(today, 1))
            }
    }
}
