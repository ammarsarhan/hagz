import Reservation from "@/utils/types/reservation";
import Payment, { PaymentMethod } from "@/utils/types/payment";
import Pitch from "@/utils/types/pitch";
import Location from "@/utils/types/location";

export default interface User {
    uid: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    profilePicture?: string;
    reservations: Reservation[];
    method: PaymentMethod;
    paymentMethods: PaymentMethod[];
    paymentHistory: Payment[];
    location: Location;
    preferences: "phone" | "sms" | "email";
    status: "active" | "verified" | "suspended";
}

export interface Owner {
    uid: string;
    firstName: string;
    lastName: string;
    company?: string;
    email: string;
    phone: string;
    password: string;
    profilePicture?: string;
    pitches: Pitch[];
    method: PaymentMethod;
    paymentMethods: PaymentMethod[];
    paymentHistory: Payment[];
    location: Location;
    preferences: "phone" | "sms" | "email";
    status: "active" | "verified" | "suspended";
}