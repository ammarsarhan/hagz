import { PermissionsType } from "@/app/utils/types/user";
import FileType from "@/app/utils/types/image";

export type AmenityName = "LIGHTING" | "SEATING" | "LOCKER_ROOMS" | "SHOWERS" | "TOILETS" | "PARKING" | "AIR_CONDITIONED" | "HEATING" | "SOUND_SYSTEM" | "WATER_FOUNTAIN" | "WIFI" | "BALL_INCLUDED" | "EQUIPMENT_RENTAL" | "FIRST_AID" | "REFEREE_SERVICE" | "CAFETERIA";
export type PaymentMethod = "CASH" | "CREDIT_CARD" | "WALLET";
export type StaffRole = "OWNER" | "MANAGER";
export type CountryEnum = "EG" | "SA" | "AE";

export interface DashboardStateType {
    permissions: Array<PermissionsType>
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
    amenities: [
        {
            name: AmenityName,
            description: string,
            isPaid: boolean,
            price: string
        }
    ],
    images: Array<FileType>,
    coverImage: string,
    layout: object
}
