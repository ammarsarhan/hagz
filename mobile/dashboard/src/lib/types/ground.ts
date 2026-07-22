import { CreateGroundPayload, PitchRequest } from "@/lib/types/pitch";
import { InferResponseType } from "hono/client";

type GroundScheduleRequest = PitchRequest['grounds'][':groundId']['schedule'];
export type GroundScheduleResponse = InferResponseType<GroundScheduleRequest['$get']>;
export type GroundSchedule = GroundScheduleResponse['data']['schedules'][number];

type GroundSettingsRequest = PitchRequest['grounds'][':groundId']['settings'];
export type GroundSettingsResponse = InferResponseType<GroundSettingsRequest['$get']>;
export type GroundSettings = GroundSettingsResponse['data']['settings'];

export type GroundDraftType = CreateGroundPayload & {
    schedule: GroundSchedule[];
    settings: GroundSettings
}