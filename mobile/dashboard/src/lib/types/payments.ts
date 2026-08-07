import { InferResponseType } from "hono/client";
import { PitchRequest } from "@/lib/types/pitch";

export type FetchPayoutsResponse = InferResponseType<PitchRequest["payouts"]["$get"]>;
export type PayoutItem = FetchPayoutsResponse["data"]["payouts"][number];

export type FetchLedgerEntriesResponse = InferResponseType<PitchRequest["payouts"]["ledgers"]["$get"]>;
export type LedgerEntryItem = FetchLedgerEntriesResponse["data"]["entries"][number];

export type LedgerAction =
    | "EXTERNAL_PAYMENT_LOG"
    | "BOOKING_REVENUE"
    | "PLATFORM_FEE_DEBIT"
    | "SERVICE_FEE_CREDIT"
    | "PAYOUT"
    | "PAYOUT_REVERSAL"
    | "ADJUSTMENT";

export const ledgerActionMap: Record<LedgerAction, { label: { en: string; ar: string } }> = {
    EXTERNAL_PAYMENT_LOG: {
        label: { en: "External Payment", ar: "دفع خارجي" },
    },
    BOOKING_REVENUE: {
        label: { en: "Booking Revenue", ar: "إيراد حجز" },
    },
    PLATFORM_FEE_DEBIT: {
        label: { en: "Platform Fee", ar: "رسوم المنصة" },
    },
    SERVICE_FEE_CREDIT: {
        label: { en: "Service Fee", ar: "رسوم الخدمة" },
    },
    PAYOUT: {
        label: { en: "Payout", ar: "تحويل مالي" },
    },
    PAYOUT_REVERSAL: {
        label: { en: "Payout Reversal", ar: "إلغاء التحويل" },
    },
    ADJUSTMENT: {
        label: { en: "Manual Adjustment", ar: "تعديل يدوي" },
    },
};

export function getLedgerActionMeta(action: LedgerAction) {
    return ledgerActionMap[action] ?? { label: { en: action, ar: action } };
}
