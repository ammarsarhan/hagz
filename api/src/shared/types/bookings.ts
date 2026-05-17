import type { PriceType } from "@/generated/prisma/enums.js";

export interface PriceSnapshotSlot {
    startsAt: Date;
    priceType: PriceType;
    price: number;
}

export interface PriceSnapshot {
    basePrice: number;
    peakPrice: number | null;
    discountPrice: number | null;
    slots: Array<PriceSnapshotSlot>;
}
