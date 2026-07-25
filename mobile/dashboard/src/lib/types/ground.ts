import type { ComponentType } from "react";
import { CreateGroundPayload, PitchRequest } from "@/lib/types/pitch";
import { InferResponseType } from "hono/client";
import {
    IconBallFootball,
    IconBallBasketball,
    IconBallTennis,
    IconPingPong,
    IconBallVolleyball,
    IconUsers,
    IconUsersGroup,
    IconRuler,
    IconPlant2,
    IconStack2,
    IconDots,
    IconProps,
    IconTexture,
    IconUser,
} from "@tabler/icons-react-native";

type IconMeta<T extends string> = Record<T,
  {
    icon: ComponentType<IconProps>;
    label: { en: string; ar: string };
  }
>;

export const sportMap: IconMeta<GroundSport> = {
    FOOTBALL: {
        icon: IconBallFootball,
        label: { en: "Football", ar: "كرة القدم" },
    },
    BASKETBALL: {
        icon: IconBallBasketball,
        label: { en: "Basketball", ar: "كرة السلة" },
    },
    PADEL: {
        icon: IconPingPong,
        label: { en: "Padel", ar: "بادل" },
    },
    TENNIS: {
        icon: IconBallTennis,
        label: { en: "Tennis", ar: "تنس" },
    },
    VOLLEYBALL: {
        icon: IconBallVolleyball,
        label: { en: "Volleyball", ar: "كرة الطائرة" },
    },
};

export function getSportMeta(sport: GroundSport) {
    return sportMap[sport];
}

export const sizeMap: IconMeta<GroundSize> = {
    FIVE_A_SIDE: {
        icon: IconUser,
        label: { en: "5-a-side", ar: "خماسي" },
    },
    SEVEN_A_SIDE: {
        icon: IconUsers,
        label: { en: "7-a-side", ar: "سباعي" },
    },
    ELEVEN_A_SIDE: {
        icon: IconUsersGroup,
        label: { en: "11-a-side", ar: "حادي عشر" },
    },
    STANDARD: {
        icon: IconRuler,
        label: { en: "Standard", ar: "قياسي" },
    },
};

export function getSizeMeta(size: GroundSize) {
    return sizeMap[size];
}

export const surfaceMap: IconMeta<GroundSurface> = {
    NATURAL_GRASS: {
        icon: IconPlant2,
        label: { en: "Natural Grass", ar: "عشب طبيعي" },
    },
    ARTIFICIAL_TURF: {
        icon: IconTexture,
        label: { en: "Artificial Turf", ar: "عشب صناعي" },
    },
    HARD_WOOD: {
        icon: IconStack2,
        label: { en: "Hard Wood", ar: "خشب صلب" },
    },
    OTHER: {
        icon: IconDots,
        label: { en: "Other", ar: "أخرى" },
    },
};

export function getSurfaceMeta(surface: GroundSurface) {
    return surfaceMap[surface];
}

export const sportSizeOptions: Record<GroundSport, GroundSize[]> = {
  FOOTBALL: ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"],
  BASKETBALL: ["STANDARD"],
  PADEL: ["STANDARD"],
  TENNIS: ["STANDARD"],
  VOLLEYBALL: ["STANDARD"],
};

export const sportSurfaceOptions: Record<GroundSport, GroundSurface[]> = {
  FOOTBALL: ["NATURAL_GRASS", "ARTIFICIAL_TURF"],
  BASKETBALL: ["HARD_WOOD", "OTHER"],
  PADEL: ["ARTIFICIAL_TURF", "OTHER"],
  TENNIS: ["NATURAL_GRASS", "ARTIFICIAL_TURF", "HARD_WOOD"],
  VOLLEYBALL: ["ARTIFICIAL_TURF", "NATURAL_GRASS", "OTHER"],
};

export function getSizeOptions(sport: GroundSport): GroundSize[] {
  return sportSizeOptions[sport];
}

export function getSurfaceOptions(sport: GroundSport): GroundSurface[] {
  return sportSurfaceOptions[sport];
}

type GroundScheduleRequest = PitchRequest['grounds'][':groundId']['schedule'];
export type GroundScheduleResponse = InferResponseType<GroundScheduleRequest['$get']>;
export type GroundSchedule = GroundScheduleResponse['data']['schedules'][number];

type GroundSettingsRequest = PitchRequest['grounds'][':groundId']['settings'];
export type GroundSettingsResponse = InferResponseType<GroundSettingsRequest['$get']>;
export type GroundSettings = GroundSettingsResponse['data']['settings'];

export type GroundDraftType = CreateGroundPayload;

export type GroundSport = GroundDraftType['sport'];
export type GroundSize = GroundDraftType['size'];
export type GroundSurface = GroundDraftType['surface'];