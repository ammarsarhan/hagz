import { Queue } from "bullmq";
import { redis } from "@/utils/redis";

const globalQueue = globalThis as unknown as {
  queue: Queue | undefined;
};

export const emailQueue = globalQueue.queue ?? new Queue("email", { connection: redis });

if (process.env.NODE_ENV !== "production") {
  globalQueue.queue = emailQueue;
};

export default emailQueue;
