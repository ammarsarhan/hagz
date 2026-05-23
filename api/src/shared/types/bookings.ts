import type { Staff } from "@/generated/prisma/client.js";
import type { PriceType } from "@/generated/prisma/enums.js";

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
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETE'
} as const

export type BookingEvent = (typeof BookingEvent)[keyof typeof BookingEvent];
