import {
  IconBulb,
  IconArmchair,
  IconDoor,
  IconBath,
  IconToiletPaper,
  IconParking,
  IconAirConditioning,
  IconFlame,
  IconSpeakerphone,
  IconDroplets,
  IconWifi,
  IconBallFootball,
  IconTools,
  IconFirstAidKit,
  IconShirtSport,
  IconCoffee,
  IconProps,
} from "@tabler/icons-react-native";
import type { ComponentType } from "react";
import { PitchAmenityPayload } from "@/lib/types/pitch";

export type Amenity = PitchAmenityPayload;

export type AmenityName = Amenity["name"];

type AmenityMeta = {
    icon: ComponentType<IconProps>;
    label: {
        en: string;
        ar: string;
    };
};

export const uniqueAmenities = new Set<AmenityName>([
    "LIGHTING",
    "SEATING",
    "LOCKER_ROOMS",
    "SHOWERS",
    "TOILETS",
    "PARKING",
    "AIR_CONDITIONED",
    "HEATING",
    "SOUND_SYSTEM",
    "WATER_FOUNTAIN",
    "WIFI",
    "FIRST_AID",
    "REFEREE_SERVICE",
    "CAFETERIA",
]);

export const stackableAmenities = new Set<AmenityName>([
    "EQUIPMENT_RENTAL",
    "BALL_INCLUDED",
]);

export const amenityMap: Record<AmenityName, AmenityMeta> = {
    LIGHTING: {
        icon: IconBulb,
        label: { en: "Lighting", ar: "إضاءة" },
    },
    SEATING: {
        icon: IconArmchair,
        label: { en: "Seating", ar: "جلسات" },
    },
    LOCKER_ROOMS: {
        icon: IconDoor,
        label: { en: "Locker Rooms", ar: "غرف تبديل الملابس" },
    },
    SHOWERS: {
        icon: IconBath,
        label: { en: "Showers", ar: "دشات" },
    },
    TOILETS: {
        icon: IconToiletPaper,
        label: { en: "Toilets", ar: "دورات مياه" },
    },
    PARKING: {
        icon: IconParking,
        label: { en: "Parking", ar: "موقف سيارات" },
    },
    AIR_CONDITIONED: {
        icon: IconAirConditioning,
        label: { en: "Air Conditioned", ar: "تكييف" },
    },
    HEATING: {
        icon: IconFlame,
        label: { en: "Heating", ar: "تدفئة" },
    },
    SOUND_SYSTEM: {
        icon: IconSpeakerphone,
        label: { en: "Sound System", ar: "نظام صوتي" },
    },
    WATER_FOUNTAIN: {
        icon: IconDroplets,
        label: { en: "Water Fountain", ar: "مبرد مياه" },
    },
    WIFI: {
        icon: IconWifi,
        label: { en: "WiFi", ar: "واي فاي" },
    },
    BALL_INCLUDED: {
        icon: IconBallFootball,
        label: { en: "Ball Included", ar: "كرة متضمنة" },
    },
    EQUIPMENT_RENTAL: {
        icon: IconTools,
        label: { en: "Equipment Rental", ar: "تأجير معدات" },
    },
    FIRST_AID: {
        icon: IconFirstAidKit,
        label: { en: "First Aid", ar: "إسعافات أولية" },
    },
    REFEREE_SERVICE: {
        icon: IconShirtSport,
        label: { en: "Referee Service", ar: "خدمة حكم" },
    },
    CAFETERIA: {
        icon: IconCoffee,
        label: { en: "Cafeteria", ar: "كافيتريا" },
    },
};

export function getAmenityMeta(name: AmenityName): AmenityMeta {
    return amenityMap[name];
};

export function isUniqueAmenity(name: AmenityName): boolean {
  return uniqueAmenities.has(name);
}
 
export function isStackableAmenity(name: AmenityName): boolean {
  return stackableAmenities.has(name);
}
