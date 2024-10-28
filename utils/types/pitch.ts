import AppLocation from '@/utils/types/location';
import { PricingPlan } from '@/utils/types/payment';

export interface Amenity {

}

export default interface Pitch {
    id: string;
    name: string;
    description: string;
    groundType: "SG" | "AG" | "FG" | "TF";
    pitchSize: "5-A-Side" | "7-A-Side" | "11-A-Side";
    images: string[];
    location: AppLocation;
    rating: number;
    amenities: Amenity[];
    activePricingPlan: PricingPlan;
    pricingPlans: PricingPlan[];
    reservations: string[];
    ownerId: string;
}