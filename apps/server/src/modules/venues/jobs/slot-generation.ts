import type { QueueName } from "@hagz/contracts";
import { Worker } from "bullmq";
import { createQueue } from "@/platform/jobs/queues";
import { logger } from "@/platform/logger/logger";
import { queueConnection } from "@/platform/redis/connections";
import {
  closeGenerationQueue,
  GENERATION_QUEUE,
  reconcileGround,
  type GenerateJob,
} from "../application/slot-generation";
import { finishRemovals } from "../application/grounds";
import { alertFailedRun, rollForward, runAudit, runChecks } from "../application/slot-monitoring";

// Slot generation's workers (PR 2.6): one queue of runs, one per ground per trigger, and one of
// upkeep on schedules: the checks every five minutes, then nightly the roll-forward and, half an
// hour later, the drift audit; and every five minutes too, finishing the removal of grounds whose
// last booking has ended (user, 2026-11-27). Schedulers are upserts, so every worker can register them without
// making a second; every job is idempotent.
const MAINTENANCE_QUEUE: QueueName = "slot-maintenance";
// Cairo's small hours, out of the evening rush, whatever the server's timezone.
const NIGHTLY = { tz: "Africa/Cairo" };

export const startSlotGeneration = async () => {
  const maintenance = createQueue(MAINTENANCE_QUEUE);
  await maintenance.upsertJobScheduler("checks", { every: 5 * 60_000 }, { name: "checks" });
  await maintenance.upsertJobScheduler("removals", { every: 5 * 60_000 }, { name: "removals" });
  await maintenance.upsertJobScheduler(
    "roll-forward",
    { pattern: "0 1 * * *", ...NIGHTLY },
    { name: "roll-forward" },
  );
  await maintenance.upsertJobScheduler(
    "audit",
    { pattern: "30 1 * * *", ...NIGHTLY },
    { name: "audit" },
  );

  const generation = new Worker<GenerateJob>(
    GENERATION_QUEUE,
    async (job) => {
      const result = await reconcileGround(job.data.groundId);
      if (result && result.created + result.updated + result.deleted > 0) {
        logger.info({ groundId: job.data.groundId, ...result }, "generated slots");
      }
      return result;
    },
    { connection: queueConnection, concurrency: 4 },
  );
  // Retries are BullMQ's; only the last failure needs a person.
  generation.on("failed", (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    void alertFailedRun(job.data.groundId, error.message).catch((err: unknown) => {
      logger.error({ err, groundId: job.data.groundId }, "couldn't raise a failed run's alert");
    });
  });

  const upkeep = new Worker(
    MAINTENANCE_QUEUE,
    async (job) => {
      const run = {
        checks: runChecks,
        "roll-forward": rollForward,
        audit: runAudit,
        removals: finishRemovals,
      }[job.name];
      if (!run) throw new Error(`Unknown slot maintenance job "${job.name}".`);
      const result = await run();
      logger.info({ job: job.name, ...result }, "slot maintenance ran");
      return result;
    },
    { connection: queueConnection },
  );

  return {
    workers: [generation, upkeep],
    close: () => Promise.all([maintenance.close(), closeGenerationQueue()]),
  };
};
