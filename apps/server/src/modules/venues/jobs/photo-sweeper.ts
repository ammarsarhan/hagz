import { Worker } from "bullmq";
import { createQueue } from "@/platform/jobs/queues";
import { logger } from "@/platform/logger/logger";
import { queueConnection } from "@/platform/redis/connections";
import { sweepPendingPhotos } from "../application/venue-media";

// Removes photo uploads asked for but never confirmed (PR 2.3), every hour. The scheduler is an
// upsert, so every worker can register it without making a second one; the sweep is idempotent.
const QUEUE = "venue-photo-sweeper";
const EVERY_HOUR_MS = 60 * 60 * 1000;

export const startPhotoSweeper = async () => {
  const queue = createQueue(QUEUE);
  await queue.upsertJobScheduler("sweep", { every: EVERY_HOUR_MS }, { name: "sweep" });
  const worker = new Worker(
    QUEUE,
    async () => {
      const removed = await sweepPendingPhotos();
      if (removed > 0) logger.info({ removed }, "removed abandoned photo uploads");
    },
    { connection: queueConnection },
  );
  return { worker, queue };
};
