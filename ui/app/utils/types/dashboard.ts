import { PermissionsType } from "@/app/utils/types/user";
import FileType from "@/app/utils/types/image";
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

export const amenityLabels = ["LIGHTING", "SEATING", "LOCKER_ROOMS", "SHOWERS", "TOILETS", "PARKING", "AIR_CONDITIONED", "HEATING", "SOUND_SYSTEM", "WATER_FOUNTAIN", "WIFI", "BALL_INCLUDED", "EQUIPMENT_RENTAL", "FIRST_AID", "REFEREE_SERVICE", "CAFETERIA"] as const;

export const amenityOptions = amenityLabels.map(a => ({
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

export const groundSportLabels = ["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"];
export const groundSizeLabels = ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE", "STANDARD"];
export const groundSurfaceLabels = ["NATURAL_GRASS", "ARTIFICIAL_TURF", "HARD_WOOD", "OTHER"];
export const groundPolicyLabels = ["STRICT", "MODERATE", "LENIENT"];

export const groundSportOptions = groundSportLabels.map(g => ({
    label: g.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
    value: g
}));

export const groundSizeOptions = groundSizeLabels.map(g => {
    if (g === "STANDARD") return { label: "Standard", value: g };
    
    return {
        label: g.toLowerCase()
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join("-"),
        value: g
    };
});

export const groundSurfaceOptions = groundSurfaceLabels.map(g => ({
    label: g.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
    value: g
}));

export const groundPolicyOptions = groundPolicyLabels.map(g => ({
    label: g.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
    value: g
}));

export const entranceAxisOptions = [
    {
        label: "Top",
        value: "TOP",
    },
    {
        label: "Bottom",
        value: "BOTTOM",
    },
    {
        label: "Left",
        value: "LEFT",
    },
    {
        label: "Right",
        value: "RIGHT",
    },
];

export const entrancePositionOptions = [
    {
        label: "Start",
        value: "START",
    },
    {
        label: "Center",
        value: "CENTER",
    },
    {
        label: "End",
        value: "END",
    },
]

export const groundPolicyDescriptions: Array<{ value: GroundPolicy, description: string, example: string }> = [
    {
        value: "STRICT",
        description: "Manual approval required. Cash bookings are held as pending until you personally confirm them. Your spot is not guaranteed until the owner reviews and approves the request. This gives owners full control over who gets confirmed, but means users may need to wait before their booking is locked in.",
        example: "Example: Ahmed books Ground A for Friday at 8PM and pays nothing upfront. The owner receives the request, checks availability, and manually confirms it — only then does Ahmed get a confirmation."
    },
    {
        value: "MODERATE",
        description: "Deposit required to confirm. Cash bookings are confirmed automatically, but only after the user pays a partial deposit upfront. The deposit acts as a commitment signal, protecting the owner from no-shows while still allowing the remainder to be settled in cash on the day.",
        example: "Example: Karim books Ground B for Saturday at 6PM. He's prompted to pay a 50 EGP deposit online. Once paid, his booking is instantly confirmed and the remaining balance is collected at the pitch."
    },
    {
        value: "LENIENT",
        description: "Instant confirmation, no deposit. Cash bookings are confirmed immediately with no upfront payment required. This offers the smoothest and fastest experience for the user, but puts the owner at higher risk of no-shows since there's no financial commitment holding the booking.",
        example: "Example: Omar books Ground A for Sunday at 10AM, selects cash as his payment method, and receives an instant confirmation — no deposit, no waiting. He simply shows up and pays on the day."
    }
];

export const paymentMethodLabels = ["CASH", "CREDIT_CARD", "WALLET"];

export const paymentMethodOptions = paymentMethodLabels.map(p => ({
    label: p.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
    value: p
}));

export type Amenity = typeof amenityLabels[number];
export type GroundSport = typeof groundSportLabels[number];
export type GroundSize = typeof groundSizeLabels[number];
export type GroundSurface = typeof groundSurfaceLabels[number];
export type GroundPolicy = typeof groundPolicyLabels[number];
export type PaymentMethod = typeof paymentMethodLabels[number];
export type StaffRole = "OWNER" | "MANAGER";
export type CountryEnum = "EG" | "SA" | "AE";
export type EntranceAxis = "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
export type EntrancePosition = "START" | "CENTER" | "END";

export interface DashboardStateType {
    permissions: Array<PermissionsType>
}

export interface AmenityType {
    id: string,
    name: Amenity,
    description: string,
    isPaid: boolean,
    price: string
};

export interface Ground {
    id: string,
    name: string,
    description: string,
    sport: GroundSport,
    surface: GroundSurface,
    size: GroundSize,
    paymentMethods: Array<PaymentMethod>,
    policy: GroundPolicy,
    depositFee?: string,
    basePrice: string,
    peakPrice: string,
    discountPrice: string,
    operatingHours: Array<number>,
    discountHours: Array<number>,
    peakHours: Array<number>,
    x: number,
    y: number,
    w: number,
    h: number,
    rotation: number
};

export interface Combination {
    id: string,
    name: string,
    description: string
}

export interface Pitch {
    id: string,
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
    amenities: Array<AmenityType>,
    images: Array<FileType>,
    coverImage: string,
    layout: {
        entrance: {
            axis: EntranceAxis,
            position: EntrancePosition
        },
        grounds: Array<Ground>,
        combinations: Array<Combination>
    }
};
