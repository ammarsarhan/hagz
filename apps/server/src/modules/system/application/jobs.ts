import { QUEUE_NAMES, type JobsStatus, type QueueName } from "@hagz/contracts";
import type { Queue } from "bullmq";
import { slotLastRuns } from "@/modules/venues";
import { AppError } from "@/platform/errors/app-error";
import { createQueue } from "@/platform/jobs/queues";

// The admin Home's Jobs card (PR 2.6): every background queue's counts and its job waiting longest,
// when slot generation's nightly runs last finished, and the jobs that failed on their last attempt,
// which an admin can retry once whatever broke them is fixed.

const queues = new Map<QueueName, Queue>();
const queueOf = (name: QueueName) => {
  let queue = queues.get(name);
  if (!queue) {
    queue = createQueue(name);
    queues.set(name, queue);
  }
  return queue;
};

const FAILED_SHOWN = 20;

const jobNotFound = () =>
  new AppError({
    code: "JOB_NOT_FOUND",
    status: 404,
    detail: "There's no failed job with that id in that queue.",
  });

const iso = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);

export const jobsStatus = async (): Promise<JobsStatus> => {
  const perQueue = await Promise.all(
    QUEUE_NAMES.map(async (name) => {
      const queue = queueOf(name);
      const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed");
      // Waiting jobs are listed oldest first.
      const [oldest] = await queue.getWaiting(0, 0);
      const failed = await queue.getFailed(0, FAILED_SHOWN - 1);
      return {
        summary: {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          oldestWaitingAt: iso(oldest?.timestamp),
        },
        failed: failed.map((job) => {
          const data = job.data as { groundId?: unknown } | undefined;
          return {
            queue: name,
            id: job.id ?? "",
            name: job.name,
            groundId: typeof data?.groundId === "string" ? data.groundId : null,
            reason: job.failedReason,
            attempts: job.attemptsMade,
            failedAt: iso(job.finishedOn),
          };
        }),
      };
    }),
  );
  return {
    queues: perQueue.map((queue) => queue.summary),
    lastRuns: await slotLastRuns(),
    failed: perQueue
      .flatMap((queue) => queue.failed)
      .sort((a, b) => (b.failedAt ?? "").localeCompare(a.failedAt ?? "")),
  };
};

export const retryJob = async (name: QueueName, jobId: string) => {
  const job = await queueOf(name).getJob(jobId);
  if (!job || !(await job.isFailed())) throw jobNotFound();
  await job.retry("failed");
};
