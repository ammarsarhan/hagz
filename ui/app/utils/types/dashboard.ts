import { PermissionsType } from "@/app/utils/types/user";
import FileType from "@/app/utils/types/image";

export const amenities = ["LIGHTING", "SEATING", "LOCKER_ROOMS", "SHOWERS", "TOILETS", "PARKING", "AIR_CONDITIONED", "HEATING", "SOUND_SYSTEM", "WATER_FOUNTAIN", "WIFI", "BALL_INCLUDED", "EQUIPMENT_RENTAL", "FIRST_AID", "REFEREE_SERVICE", "CAFETERIA"] as const;
export const amenityOptions = amenities.map(a => ({
    label: a.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
    value: a,
}));

export type AmenityName = typeof amenities[number];
export type PaymentMethod = "CASH" | "CREDIT_CARD" | "WALLET";
export type StaffRole = "OWNER" | "MANAGER";
export type CountryEnum = "EG" | "SA" | "AE";

export interface DashboardStateType {
    permissions: Array<PermissionsType>
}

export interface Amenity {
    name: AmenityName,
    description: string,
    isPaid: boolean,
    price: string
}

export interface CreatePitchFormType {
    name: string,
    description: string,
    taxId: string,
    street: string,
    area: string,
    city: string,
    country: CountryEnum,
    googleMapsLink: string,
    amenities: Array<Amenity>,
    images: Array<FileType>,
    coverImage: string,
    layout: object
}
