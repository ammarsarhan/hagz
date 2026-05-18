import { Queue } from "bullmq";
import { redis } from "@/shared/lib/utils/redis.js";

export const slotsQueue = new Queue("slots", {
    connection: redis
});
