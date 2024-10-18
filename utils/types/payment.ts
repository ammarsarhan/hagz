import Location from "@/utils/types/location"
import Reservation from "@/utils/types/reservation"

interface Card {
    cardNumber: number;
    cvc: number;
    expiration: Date;
}

interface Wallet {
    service: string;
    phoneNumber: number;
}

export interface PaymentMethod {
    type: "cash" | "card" | "wallet";
    firstName: string;
    lastName: string;
    details?: Card | Wallet;
    billing: Location;
}

export default interface Payment {
    reservation: Reservation;
    amount: number;
    date: Date;
    method: PaymentMethod;
    status: "pending" | "done" | "cancelled";
}