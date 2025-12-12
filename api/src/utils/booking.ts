import { addMonths, addWeeks, isAfter, isBefore, parseISO } from "date-fns";
import { BillingMethod, BookingSource, BookingStatus, RecurrenceFrequency, RecurrencePayment } from "generated/prisma";
import z from "zod";

export interface ResolvedSettings {
    minBookingHours: number;
    maxBookingHours: number;
    cancellationFee: number;
    noShowFee: number;
    advanceBooking: number;
    paymentDeadline: number;
    peakHourSurcharge: number;
    offPeakDiscount: number;
};

export interface Bookings {
    id: string;
    referenceCode: string;
    status: BookingStatus;
    source: string;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    notes: string | null;
    issuedTo: string;
    grounds: Array<{
        id: string;
        name: string;
    }>;
    isRecurring: boolean;
    createdAt: Date;
};

export const unavailableStates = ["PENDING", "APPROVED", "CONFIRMED", "IN_PROGRESS"] as BookingStatus[];

export const intervalSchema = z.enum(["ONE_WEEK", "TWO_WEEK", "THREE_WEEK", "ONE_MONTH", "TWO_MONTH"]);
export const recurringFrequencySchema = z.enum(Object.values(RecurrenceFrequency));
export const recurringPaymentSchema = z.enum(Object.values(RecurrencePayment));

export const recurringOptionsSchema = z.object({
    occurrences: z.number().int().min(1).max(6),
    endsAt: z.string().or(z.date()).transform((val) => typeof val === "string" ? parseISO(val) : val),
    interval: intervalSchema,
    frequency: recurringFrequencySchema,
    payment: recurringPaymentSchema
});

export const timeslotSchema = z.object({
    startTime: z.string().or(z.date()).transform((val) => typeof val === "string" ? parseISO(val) : val),
    endTime: z.string().or(z.date()).transform((val) => typeof val === "string" ? parseISO(val) : val)
})
.refine((data) => isAfter(data.endTime, data.startTime), "End time must always be after start time.");

export const createSchema = z.object({
    bookingId: z.uuid().optional(),
    startedAt: z.string().or(z.date()).transform((val) => typeof val === "string" ? parseISO(val) : val).optional(),
    target: z.uuid(),
    targetType: z.enum(["GROUND", "COMBINATION"]),
    startDate: z.string().or(z.date()).transform((val) => typeof val === "string" ? parseISO(val) : val),
    timeslots: z.array(timeslotSchema).min(1),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().min(11).max(11),
    source: z.enum(Object.values(BookingSource)),
    paymentMethod: z.enum(Object.values(BillingMethod)).nullable(),
    notes: z.string().max(1000).optional().default(""),
    recurringOptions: recurringOptionsSchema.nullable()
}).refine((data) => {
    const slots = data.timeslots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    for (let i = 0; i < slots.length - 1; i++) {
        if (isAfter(slots[i].endTime, slots[i + 1].startTime)) {
            return false;
        }
    };

    return true;
}, {
  message: "Timeslots cannot overlap."
});

export const fetchSchema = z.object({
    page: z.string().optional().transform(str => str ? parseInt(str) : 1),
    limit: z.string().optional().transform(str => str ? parseInt(str) : 50),
    target: z.string().uuid("Please enter a valid target ID.").optional(),
    type: z.enum(["ALL", "GROUND", "COMBINATION"]),
    start: z.string().transform((str) => {
        const date = parseISO(str);
        if (!isNaN(date.getTime())) return date;
        throw new Error("Invalid start date format.");
    }),
    end: z.string().optional().transform((str) => {
        if (!str) return undefined;
        const date = parseISO(str);
        if (!isNaN(date.getTime())) return date;
        throw new Error("Invalid end date format.");
    }),
    status: z.enum(Object.values(BookingStatus)).optional()
})
.refine(data => {
    if (!data.end) return true;
    return isBefore(data.start, data.end) || data.start.getTime() === data.end.getTime();
}, "Start date must be before or equal to end date.")
.refine(data => {
    // Target is required for GROUND and COMBINATION types
    if ((data.type === "GROUND" || data.type === "COMBINATION") && !data.target) {
        return false;
    }

    return true;
}, {
    message: "Target ID is required for GROUND and COMBINATION types.",
    path: ["target"]
});

export function getIntervalAmount(interval: z.infer<typeof intervalSchema>): { amount: number; unit: "week" | "month" } {
    const map = {
        ONE_WEEK: { amount: 1, unit: "week" as const },
        TWO_WEEK: { amount: 2, unit: "week" as const },
        THREE_WEEK: { amount: 3, unit: "week" as const },
        ONE_MONTH: { amount: 1, unit: "month" as const },
        TWO_MONTH: { amount: 2, unit: "month" as const }
    };
  
  return map[interval];
};

export function generateRecurringDates(startDate: Date, occurrences: number, interval: z.infer<typeof intervalSchema>, endsAt?: Date): Date[] {
    const dates: Date[] = [startDate];
    const { amount, unit } = getIntervalAmount(interval);
    let currentDate = startDate;

    for (let i = 1; i < occurrences; i++) {
        currentDate = unit === "week" ? addWeeks(currentDate, amount) : addMonths(currentDate, amount);
        
        if (endsAt && !occurrences && isAfter(currentDate, endsAt)) break;
        
        dates.push(currentDate);
    };

    return dates;
};

export function generateReferenceCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";

    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    };

    return code;
};

export function resolveInitialBookingStatus(isUser: boolean, automaticApproval: boolean, isPaid: boolean, isCash: boolean, issuedByOwner: boolean): BookingStatus {
    if (!issuedByOwner && !automaticApproval) {
        return "UNAPPROVED";
    };

    if (isUser) {
        return "UNAPPROVED";
    };

    if (isCash || isPaid) {
        return "CONFIRMED";
    };
    
    return "PENDING";
}
