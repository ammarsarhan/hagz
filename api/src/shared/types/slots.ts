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
