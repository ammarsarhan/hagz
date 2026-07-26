import type { ComponentType } from "react";
import { CreateGroundPayload, PitchRequest } from "@/lib/types/pitch";
import { InferRequestType, InferResponseType } from "hono/client";
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

import type { PriceRange, PriceSchedule } from "@/components/shared/ScheduleCircle";

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
export type UpsertGroundScheduleRequest = InferRequestType<GroundScheduleRequest[':dayOfWeek']['$put']>;
export type UpsertGroundSchedulePayload = UpsertGroundScheduleRequest['json'];

export type GroundSchedule = GroundScheduleResponse['data']['schedules'][number];

type GroundSettingsRequest = PitchRequest['grounds'][':groundId']['settings'];
export type GroundSettingsResponse = InferResponseType<GroundSettingsRequest['$get']>;
export type GroundSettings = GroundSettingsResponse['data']['settings'];

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Sunday ... 7 = Saturday
export const DAYS_OF_WEEK: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

export type DaySchedule = PriceSchedule & { isActive: boolean };
export type GroundScheduleDraft = Record<DayOfWeek, DaySchedule>;

export const DEFAULT_DAY_SCHEDULE: DaySchedule = {
    isActive: true,
    base: { startHour: 9, endHour: 17 },
    peak: { startHour: 18, endHour: 22 },
    discount: { startHour: 0, endHour: 6 },
};

export function buildDefaultScheduleDraft(): GroundScheduleDraft {
    return DAYS_OF_WEEK.reduce((acc, day) => {
        acc[day] = { ...DEFAULT_DAY_SCHEDULE };
        return acc;
    }, {} as GroundScheduleDraft);
}

export function fromGroundSchedule(schedule: GroundSchedule): DaySchedule {
    const firstRange = (
        ranges: { start: number; end: number }[],
        fallback: { startHour: number; endHour: number }
    ) => (ranges[0] ? { startHour: ranges[0].start, endHour: ranges[0].end } : fallback);

    return {
        isActive: schedule.isActive,
        base: firstRange(schedule.baseHours, DEFAULT_DAY_SCHEDULE.base),
        peak: firstRange(schedule.peakHours, DEFAULT_DAY_SCHEDULE.peak),
        discount: firstRange(schedule.discountHours, DEFAULT_DAY_SCHEDULE.discount),
    };
}

// Builds a full 7-day draft from whatever subset of days the server returns.
export function buildScheduleDraft(schedules: GroundSchedule[]): GroundScheduleDraft {
    const draft = buildDefaultScheduleDraft();
    for (const schedule of schedules) {
        draft[schedule.dayOfWeek as DayOfWeek] = fromGroundSchedule(schedule);
    }
    return draft;
}

function toRangePayload(range: PriceRange): { start: number; end: number }[] {
    let startHour = Math.round(range.startHour);
    let endHour = Math.round(range.endHour);

    // Normalize 24 to 23 for end hour
    if (endHour === 24) endHour = 23;
    if (startHour === 24) startHour = 22;

    if (startHour === endHour) return [];

    let raw: { start: number; end: number }[] = [];

    if (startHour < endHour) {
        raw = [{ start: startHour, end: endHour }];
    } else if (startHour > endHour) {
        // Wraps across midnight (e.g. 19 -> 2)
        raw = [
            { start: startHour, end: 23 },
            { start: 0, end: endHour },
        ];
    }

    return raw
        .map(({ start, end }) => ({
            start: Math.min(Math.max(start, 0), 22),
            end: Math.min(Math.max(end, 1), 23),
        }))
        .filter(({ start, end }) => start < end)
        .sort((a, b) => a.start - b.start);
}

export function toUpsertPayload(day: DaySchedule): UpsertGroundSchedulePayload {
    if (!day.isActive) {
        return { isActive: false, baseHours: [], peakHours: [], discountHours: [] };
    }

    const baseRaw = toRangePayload(day.base).map((r) => ({ ...r, type: "base" as const }));
    const peakRaw = toRangePayload(day.peak).map((r) => ({ ...r, type: "peak" as const }));
    const discountRaw = toRangePayload(day.discount).map((r) => ({ ...r, type: "discount" as const }));

    // Combine and sort by start time
    const all = [...baseRaw, ...peakRaw, ...discountRaw].sort((a, b) => a.start - b.start);

    // Resolve overlaps by clipping overlapping end times
    const sanitized: { start: number; end: number; type: "base" | "peak" | "discount" }[] = [];
    for (let i = 0; i < all.length; i++) {
        let curr = { ...all[i] };
        if (i < all.length - 1 && curr.end > all[i + 1].start) {
            curr.end = all[i + 1].start;
        }
        if (curr.start < curr.end) {
            sanitized.push(curr);
        }
    }

    let baseHours = sanitized.filter((r) => r.type === "base").map(({ start, end }) => ({ start, end }));
    let peakHours = sanitized.filter((r) => r.type === "peak").map(({ start, end }) => ({ start, end }));
    let discountHours = sanitized.filter((r) => r.type === "discount").map(({ start, end }) => ({ start, end }));

    // Schema requires baseHours.length > 0 when active
    if (baseHours.length === 0) {
        baseHours = [{ start: 9, end: 17 }];
    }

    return {
        isActive: true,
        baseHours,
        peakHours,
        discountHours,
    };
}

export type GroundDraftType = CreateGroundPayload & {
    schedule?: GroundScheduleDraft;
};

export type GroundSport = GroundDraftType['sport'];
export type GroundSize = GroundDraftType['size'];
export type GroundSurface = GroundDraftType['surface'];