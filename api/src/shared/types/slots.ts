import { SlotStatus } from "@/generated/prisma/enums.js";

export const GroundSlotEvent = {
    GENERATE: "GENERATE",
    EXTEND: "EXTEND",
    ADJUST: "ADJUST",
} as const;

export type GroundSlotEvent = (typeof GroundSlotEvent)[keyof typeof GroundSlotEvent];

export type GroundSlotJobPayload = { 
    groundId: string, 
    pitchId: string,
    event: GroundSlotEvent,
    dayOfWeek?: number
};

type PitchAvailabilityRawSlot = {
    startsAt: Date;
    status: SlotStatus;
    groundId: string;
};

export type PitchAvailabilitySlot = {
    startsAt: Date;
    [SlotStatus.AVAILABLE]: string[];
    [SlotStatus.BOOKED]: string[];
    [SlotStatus.INACTIVE]: string[];
};

import { differenceInMilliseconds } from "date-fns";

// Helper function that converts the raw query data from the availability query into parseable data on the frontend.
export function formatPitchAvailabilityQuery(slots: PitchAvailabilityRawSlot[]): PitchAvailabilitySlot[] {
    const grouped = slots.reduce((acc, slot) => {
        const key = slot.startsAt.toISOString();

        if (!acc[key]) {
            acc[key] = {
                startsAt: slot.startsAt,
                [SlotStatus.AVAILABLE]: [],
                [SlotStatus.BOOKED]: [],
                [SlotStatus.INACTIVE]: [],
            };
        }

        acc[key][slot.status].push(slot.groundId);
        return acc;
    }, {} as Record<string, PitchAvailabilitySlot>);

    return Object.values(grouped).sort(
        (a, b) => differenceInMilliseconds(a.startsAt, b.startsAt)
    );
};
