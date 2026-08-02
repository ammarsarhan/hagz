import { BookingChannel, PaymentMethod } from "@/generated/prisma/enums.js";
import z from "zod";

export type CreateUserBookingPayloadType = z.infer<typeof createUserBookingSchema>;

export const createUserBookingSchema = z.object({
    pitchId: z
        .cuid("A valid pitch ID must be provided to create a booking."),
    groundId: z
        .cuid("A valid ground ID must be provided to create a booking."),
    startTime: z
        .coerce
        .date("A start time must be provided to create the booking.")
        .refine(value => value > new Date(), "Start time must be in the future."),
    endTime: z
        .coerce
        .date("An end time must be provided to create the booking."),
    paymentMethod: z.enum(Object.values(PaymentMethod))
})
.refine(data => data.endTime > data.startTime, "End time must be after start time.");

const createStaffBookingCustomerSchema = z.object({
    phone: z
        .string("Phone number is required.")
        .regex(/^\+[1-9]\d{7,14}$/, "Phone number must include the international code and be in an acceptable format."),
    firstName: z
        .string("Customer first name must be provided.")
        .min(2, "Customer first name must be at least 2 characters long.")
        .max(100, "Customer first name may not be longer than 100 characters.")
        .optional(),
    lastName: z
        .string("Customer last name must be provided.")
        .min(2, "Customer last name must be at least 2 characters long.")
        .max(100, "Customer last name may not be longer than 100 characters.")
        .optional()
})

const bookingTimeRangeSchema = z.object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
}).refine(
    (data) => data.endTime > data.startTime,
    { message: "endTime must be after startTime.", path: ["endTime"] }
).refine(
    (data) => data.startTime > new Date(),
    { message: "startTime must be in the future.", path: ["startTime"] }
);

export const createStaffCheckoutBookingSchema = bookingTimeRangeSchema.and(z.object({
    paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.WALLET]),
    channel: z.enum([BookingChannel.WHATSAPP, BookingChannel.PHONE, BookingChannel.OTHER]),
    customer: createStaffBookingCustomerSchema,
}));

export const createStaffDirectBookingSchema = bookingTimeRangeSchema.and(z.object({
    paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.WALLET]),
    channel: z.enum([BookingChannel.WALK_IN, BookingChannel.WHATSAPP, BookingChannel.PHONE, BookingChannel.OTHER]),
    paymentNote: z.string().max(500).optional(),
    customer: createStaffBookingCustomerSchema,
}));

export type CreateStaffCheckoutBookingPayloadType = z.infer<typeof createStaffCheckoutBookingSchema>;
export type CreateStaffDirectBookingPayloadType = z.infer<typeof createStaffDirectBookingSchema>;

export type RescheduleUserBookingPayloadType = z.infer<typeof rescheduleUserBookingSchema>;

export const rescheduleUserBookingSchema = z.object({
    startTime: z
        .coerce
        .date()
        .refine(value => value > new Date(), "Start time must be in the future."),
    endTime: z
        .coerce
        .date(),
});
