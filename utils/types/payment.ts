import AppLocation from "@/utils/types/location";

export type PaymentMethodType = "Cash" | "Card" | "Wallet";

export type Card = {
    cardNumber: string;
    cvc: string;
    expiration: string;
}

export type Wallet = {
    phoneNumber: string;
}

export type Cash = {
    location: AppLocation;
}

export interface PricingPlan {
    price: number;
    deposit: number | null;
    discount: number | null;
}

export interface PaymentMethod {
    type: PaymentMethodType;
    recieverName: string;
    details: Card | Wallet | Cash;
}

export default interface Payment {
    reservation: string;
    amount: number;
    date: string;
    method: PaymentMethod;
    status: "Pending" | "Done" | "Cancelled";
}