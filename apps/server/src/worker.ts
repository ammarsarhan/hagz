import type { Worker } from "bullmq";
import { handleShutdown } from "@/platform/lifecycle/shutdown";
import { logger } from "@/platform/logger/logger";

// Register workers here, e.g. new Worker(name, processor, { connection: queueConnection }).
const workers: Worker[] = [];

logger.info({ workers: workers.length }, "worker started");

// close() stops fetching new jobs and waits for the running ones. A job cut off by the deadline is
// retried by BullMQ, so every job must be idempotent.
handleShutdown(async () => {
  await Promise.all(workers.map((w) => w.close()));
});
