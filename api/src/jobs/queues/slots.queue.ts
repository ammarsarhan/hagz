import { Queue } from "bullmq";
import { redis } from "@/shared/lib/redis.js";

export const slotQueue = new Queue("slot", {
    connection: redis.producer
});
