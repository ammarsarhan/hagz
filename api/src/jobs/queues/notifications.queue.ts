import { Queue } from "bullmq";
import { redis } from "@/shared/lib/utils/redis.js";
import type { NotificationsJobPayload } from "@/shared/types/notifications.js";

export const notificationsQueue = new Queue<NotificationsJobPayload>("notifications", {
    connection: redis.producer
});
