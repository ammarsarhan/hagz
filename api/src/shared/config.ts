import { PitchStatus } from "@/generated/prisma/enums.js";

const config = {
    MAXIMUM_GROUNDS_PER_PITCH: 10,
    MAXIMUM_PITCHES_PER_USER: 5,
    MAXIMUM_AMENITIES_PER_PITCH: 10,
    EDITABLE_STATES: [PitchStatus.DRAFT, PitchStatus.LIVE, PitchStatus.MAINTENANCE] as PitchStatus[],
    ACTIVE_STATES: [PitchStatus.ACCEPTED, PitchStatus.LIVE, PitchStatus.MAINTENANCE] as PitchStatus[],
}

export default config;
