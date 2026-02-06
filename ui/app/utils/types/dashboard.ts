import { PermissionsType } from "@/app/utils/types/user";
import FileType from "@/app/utils/types/image";
import { IconType } from "react-icons";
import { 
    TbBulb,
    TbArmchair,
    TbDoor,
    TbToiletPaper,
    TbParking,
    TbAirConditioning,
    TbFlame,
    TbVolume,
    TbDroplet,
    TbWifi,
    TbTool,
    TbFirstAidKit,
    TbToolsKitchen2,
    TbBallFootball,
    TbCards,
    TbAccessible
} from 'react-icons/tb';

export const amenities = ["LIGHTING", "SEATING", "LOCKER_ROOMS", "SHOWERS", "TOILETS", "PARKING", "AIR_CONDITIONED", "HEATING", "SOUND_SYSTEM", "WATER_FOUNTAIN", "WIFI", "BALL_INCLUDED", "EQUIPMENT_RENTAL", "FIRST_AID", "REFEREE_SERVICE", "CAFETERIA"] as const;

export const amenityOptions = amenities.map(a => ({
    label: a.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
    value: a,
}));

export const amenityIcons = [
    {
        value: "LIGHTING",
        icon: TbBulb
    },
    {
        value: "SEATING",
        icon: TbArmchair
    },
    {
        value: "LOCKER_ROOMS",
        icon: TbDoor
    },
    {
        value: "SHOWERS",
        icon: TbAccessible
    },
    {
        value: "TOILETS",
        icon: TbToiletPaper
    },
    {
        value: "PARKING",
        icon: TbParking
    },
    {
        value: "AIR_CONDITIONED",
        icon: TbAirConditioning
    },
    {
        value: "HEATING",
        icon: TbFlame
    },
    {
        value: "SOUND_SYSTEM",
        icon: TbVolume
    },
    {
        value: "WATER_FOUNTAIN",
        icon: TbDroplet
    },
    {
        value: "WIFI",
        icon: TbWifi
    },
    {
        value: "BALL_INCLUDED",
        icon: TbBallFootball
    },
    {
        value: "EQUIPMENT_RENTAL",
        icon: TbTool
    },
    {
        value: "FIRST_AID",
        icon: TbFirstAidKit
    },
    {
        value: "REFEREE_SERVICE",
        icon: TbCards
    },
    {
        value: "CAFETERIA",
        icon: TbToolsKitchen2
    }
];

export type AmenityName = typeof amenities[number];
export type PaymentMethod = "CASH" | "CREDIT_CARD" | "WALLET";
export type StaffRole = "OWNER" | "MANAGER";
export type CountryEnum = "EG" | "SA" | "AE";

export interface DashboardStateType {
    permissions: Array<PermissionsType>
}

export interface Amenity {
    id: string,
    name: AmenityName,
    description: string,
    isPaid: boolean,
    price: string
};

export interface CreatePitchFormType {
    name: string,
    description: string,
    taxId: string,
    street: string,
    area: string,
    city: string,
    country: CountryEnum,
    googleMapsLink: string,
    longitude: string,
    latitude: string,
    amenities: Array<Amenity>,
    images: Array<FileType>,
    coverImage: string,
    layout: object
};
