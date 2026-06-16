import { Queue } from "bullmq";
import { redis } from "@/shared/lib/utils/redis.js";
import type { PitchJobPayload } from "@/shared/types/pitches.js";

export const pitchesQueue = new Queue<PitchJobPayload>("pitches", {
    connection: redis
});
