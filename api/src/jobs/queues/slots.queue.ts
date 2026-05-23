import { Queue } from "bullmq";
import { redis } from "@/shared/lib/utils/redis.js";
import type { GroundSlotJobPayload } from "@/shared/types/slots.js";

export const slotsQueue = new Queue<GroundSlotJobPayload>("slots", {
    connection: redis
});
