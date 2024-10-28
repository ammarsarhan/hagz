import Payment, { PaymentMethod } from '@/utils/types/payment';
import AppLocation from '@/utils/types/location';
import Pitch from '@/utils/types/pitch'

export default interface Owner {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    email: string;
    phone: string;
    password: string;
    profilePicture: string | null;
    pitches: string[];
    activePaymentMethod: PaymentMethod;
    paymentMethods: PaymentMethod[];
    paymentHistory: Payment[];
    location: AppLocation;
    preferences: "Email" | "SMS" | "Phone";
    phoneStatus: "Inactive" | "Verified" | "Suspended";
    emailStatus: "Inactive" | "Verified" | "Suspended";
}