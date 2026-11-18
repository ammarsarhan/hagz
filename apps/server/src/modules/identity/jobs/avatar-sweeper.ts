import { Worker } from "bullmq";
import { createQueue } from "@/platform/jobs/queues";
import { logger } from "@/platform/logger/logger";
import { queueConnection } from "@/platform/redis/connections";
import { sweepAvatarUploads } from "../application/avatars";

// Removes profile photo uploads asked for but never confirmed (PR 2.3), every hour. The scheduler
// is an upsert, so every worker can register it without making a second one; the sweep is
// idempotent.
const QUEUE = "customer-avatar-sweeper";
const EVERY_HOUR_MS = 60 * 60 * 1000;

export const startAvatarSweeper = async () => {
  const queue = createQueue(QUEUE);
  await queue.upsertJobScheduler("sweep", { every: EVERY_HOUR_MS }, { name: "sweep" });
  const worker = new Worker(
    QUEUE,
    async () => {
      const removed = await sweepAvatarUploads();
      if (removed > 0) logger.info({ removed }, "removed abandoned avatar uploads");
    },
    { connection: queueConnection },
  );
  return { worker, queue };
};
