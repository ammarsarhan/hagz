export const PitchEvent = {
    EXPIRE_BOOKING: "EXPIRE_BOOKING"
} as const;

export type PitchEvent = (typeof PitchEvent)[keyof typeof PitchEvent];

export type PitchJobPayload = {
    pitchId: string;
    bookingId: string;
    event: PitchEvent;
};
