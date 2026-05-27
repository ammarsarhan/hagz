import { BookingStatus, PitchStatus, ScheduleStatus } from "@/generated/prisma/enums.js";

const config = {
    MAXIMUM_GROUNDS_PER_PITCH: 10,
    MAXIMUM_PITCHES_PER_USER: 5,
    MAXIMUM_AMENITIES_PER_PITCH: 10,
    MAXIMUM_MEDIA_PER_PITCH: 10,
    SERVICE_RATE: 1.5,
    EDITABLE_STATES: [PitchStatus.DRAFT, PitchStatus.MAINTENANCE] as PitchStatus[],
    ACTIVE_STATES: [PitchStatus.ACCEPTED, PitchStatus.LIVE] as PitchStatus[],
    GENERATING_STATES: [ScheduleStatus.PENDING, ScheduleStatus.GENERATING] as ScheduleStatus[],
    CANCELLABLE_STATES: [BookingStatus.RESERVED, BookingStatus.CONFIRMED] as BookingStatus[]
}

export default config;
