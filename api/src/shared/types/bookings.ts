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
