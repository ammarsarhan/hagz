import AppLocation from '@/utils/types/location';
import { PricingPlan } from '@/utils/types/payment';

export type Amenity = "Indoors" | "BallProvided" | "Seating" | "NightLights" | "Parking" | "Showers" | "ChangingRooms" | "Cafeteria" | "FirstAid" | "Security";

export default interface PitchType {
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