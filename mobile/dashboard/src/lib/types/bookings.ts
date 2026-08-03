import { PitchRequest } from "@/lib/types/pitch";
import { InferRequestType, InferResponseType } from "hono/client";

export type BookingRowResponse = InferResponseType<PitchRequest['bookings']['$get']>;
export type BookingRowData = BookingRowResponse['data']['slots'][number];

type BookingDirectRequest = InferRequestType<PitchRequest['grounds'][':groundId']['bookings']['direct']['$post']>;
export type BookingDirectPayload = BookingDirectRequest['json'];

type BookingCheckoutRequest = InferRequestType<PitchRequest['grounds'][':groundId']['bookings']['checkout']['$post']>;
export type BookingCheckoutPayload = BookingCheckoutRequest['json'];

export type PricingSnapshot = {
    basePrice: number;
    peakPrice: number | null;
    discountPrice: number | null;
    allowDeposit: boolean;
    depositPercentage: number | null;
    slots: {
        startsAt: Date;
        priceType: "BASE" | "PEAK" | "DISCOUNT";
        price: number;
    }[];
};
