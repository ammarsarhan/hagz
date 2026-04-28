import { AmenityName } from "@/generated/prisma/client.js";

export const UNIQUE_AMENITIES = new Set<AmenityName>([
    AmenityName.LIGHTING,
    AmenityName.SEATING,
    AmenityName.LOCKER_ROOMS,
    AmenityName.SHOWERS,
    AmenityName.TOILETS,
    AmenityName.PARKING,
    AmenityName.AIR_CONDITIONED,
    AmenityName.HEATING,
    AmenityName.SOUND_SYSTEM,
    AmenityName.WATER_FOUNTAIN,
    AmenityName.WIFI,
    AmenityName.FIRST_AID,
    AmenityName.REFEREE_SERVICE,
    AmenityName.CAFETERIA,
]);

export const STACKABLE_AMENITIES = new Set<AmenityName>([
    AmenityName.EQUIPMENT_RENTAL,
    AmenityName.BALL_INCLUDED,
]);
