import type { Worker } from "bullmq";
import { startAvatarSweeper } from "@/modules/identity";
import { startWorkerHeartbeat } from "@/modules/system";
import { startPhotoSweeper } from "@/modules/venues";
import { handleShutdown } from "@/platform/lifecycle/shutdown";
import { logger } from "@/platform/logger/logger";

// Register workers here, e.g. new Worker(name, processor, { connection: queueConnection }).
const photoSweeper = await startPhotoSweeper();
const avatarSweeper = await startAvatarSweeper();
const workers: Worker[] = [photoSweeper.worker, avatarSweeper.worker];

// Tells the admin home this worker is alive (and which commit it runs), even before it has jobs.
const stopHeartbeat = startWorkerHeartbeat();

logger.info({ workers: workers.length }, "worker started");

// close() stops fetching new jobs and waits for the running ones. A job cut off by the deadline is
// retried by BullMQ, so every job must be idempotent.
handleShutdown(async () => {
  await stopHeartbeat();
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([photoSweeper.queue.close(), avatarSweeper.queue.close()]);
});
