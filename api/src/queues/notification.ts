import { Queue } from "bullmq";
import { redis } from "@/utils/redis";

const globalQueue = globalThis as unknown as {
  queue: Queue | undefined;
};

export const notificationQueue = globalQueue.queue ?? new Queue("notification", { connection: redis });

if (process.env.NODE_ENV !== "production") {
  globalQueue.queue = notificationQueue;
};

export default notificationQueue;
