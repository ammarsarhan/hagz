import Payment, { PaymentMethod } from '@/utils/types/payment';
import AppLocation from '@/utils/types/location';

export type PreferencesType = "Email" | "SMS" | "Phone";

export default interface Owner {
    id: string;
    firstName: string;
    lastName: string;
    company?: string | null;
    email: string;
    phone: string;
    password: string;
    profilePicture?: string | null;
    pitches: string[];
    activePaymentMethod: PaymentMethod;
    paymentMethods: PaymentMethod[];
    paymentHistory: Payment[];
    location: AppLocation;
    preferences: PreferencesType;
    phoneStatus: "Inactive" | "Verified" | "Suspended";
    emailStatus: "Inactive" | "Verified" | "Suspended";
}