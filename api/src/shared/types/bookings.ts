import type { Booking, Cancellation, Ground, GroundSlot, Payment, Pitch, Rescheduling, Staff } from "@/generated/prisma/client.js";
import type { BookingChannel, BookingStatus, Country, GroundSize, GroundSport, GroundSurface, PaymentMethod, PriceType, RefundStatus } from "@/generated/prisma/enums.js";

export interface PricingSnapshotSlot {
    startsAt: Date;
    priceType: PriceType;
    price: number;
}

export interface PricingSnapshot {
    basePrice: number;
    peakPrice: number | null;
    discountPrice: number | null;
    allowDeposit: boolean;
    depositPercentage: number | null;
    slots: Array<PricingSnapshotSlot>;
}

export type BookingJobPayload = { 
    bookingId: string,
    event: BookingEvent
};

export const BookingEvent = {
  APPROVAL: 'APPROVAL',
  PAYMENT: 'PAYMENT',
  REMINDER: 'REMINDER',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETE'
} as const

export type BookingEvent = (typeof BookingEvent)[keyof typeof BookingEvent];

type ExtendedBooking = Booking & {
    ground: Ground;
    pitch: Pick<Pitch, "id" | "name" | "street" | "area" | "city" | "country" | "latitude" | "longitude" | "googleMapsLink">;
    slots: GroundSlot[];
    payment: Payment | null;
    rescheduledFrom: Rescheduling | null;
    rescheduledTo: Rescheduling | null;
    cancellation: Cancellation | null;
};

export interface UserBooking {
    id: string;
    status: BookingStatus;
    channel: BookingChannel;
    pitch: {
        id: string;
        name: string;
        street: string;
        area: string;
        city: string;
        country: Country;
        latitude: number;
        longitude: number;
        googleMapsLink: string;
    };
    ground: {
        id: string;
        name: string;
        sport: GroundSport;
        surface: GroundSurface;
        size: GroundSize;
    };
    slots: {
        id: string;
        startsAt: Date;
        priceType: PriceType;
    }[];
    startTime: Date;
    endTime: Date;
    totalAmount: number;
    depositFee: number | null;
    paymentMethod: PaymentMethod;
    payment: {
        id: string;
        method: PaymentMethod;
        totalAmount: number;
        depositFee: number | null;
        refundStatus: RefundStatus;
        refundAmount: number | null;
        refundedAt: Date | null;
        createdAt: Date;
    } | null;
    rescheduledFrom: {
        id: string;
        rescheduledAt: Date;
        reason: string | null;
    } | null;
    rescheduledTo: {
        id: string;
        rescheduledAt: Date;
        reason: string | null;
    } | null;
    cancellation: {
        id: string;
        reason: string | null;
        cancelledAt: Date;
    } | null;
    isApproved: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export function formatUserBooking(bookings: ExtendedBooking[]): UserBooking[] {
    return bookings.map(booking => ({
        id: booking.id,
        status: booking.status,
        channel: booking.channel,
        pitch: {
            id: booking.pitch.id,
            name: booking.pitch.name,
            street: booking.pitch.street,
            area: booking.pitch.area,
            city: booking.pitch.city,
            country: booking.pitch.country,
            latitude: booking.pitch.latitude,
            longitude: booking.pitch.longitude,
            googleMapsLink: booking.pitch.googleMapsLink,
        },
        ground: {
            id: booking.ground.id,
            name: booking.ground.name,
            sport: booking.ground.sport,
            surface: booking.ground.surface,
            size: booking.ground.size,
        },
        slots: booking.slots.map(slot => ({
            id: slot.id,
            startsAt: slot.startsAt,
            priceType: slot.priceType,
        })),
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalAmount: booking.totalAmount,
        depositFee: booking.depositFee,
        paymentMethod: booking.paymentMethod,
        payment: booking.payment ? {
            id: booking.payment.id,
            method: booking.payment.method,
            totalAmount: booking.payment.totalAmount,
            depositFee: booking.payment.depositFee,
            refundStatus: booking.payment.refundStatus,
            refundAmount: booking.payment.refundAmount,
            refundedAt: booking.payment.refundedAt,
            createdAt: booking.payment.createdAt,
        } : null,
        rescheduledFrom: booking.rescheduledFrom ? {
            id: booking.rescheduledFrom.id,
            rescheduledAt: booking.rescheduledFrom.rescheduledAt,
            reason: booking.rescheduledFrom.reason,
        } : null,
        rescheduledTo: booking.rescheduledTo ? {
            id: booking.rescheduledTo.id,
            rescheduledAt: booking.rescheduledTo.rescheduledAt,
            reason: booking.rescheduledTo.reason,
        } : null,
        cancellation: booking.cancellation ? {
            id: booking.cancellation.id,
            reason: booking.cancellation.reason,
            cancelledAt: booking.cancellation.cancelledAt,
        } : null,
        isApproved: booking.isApproved,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
    }));
}
