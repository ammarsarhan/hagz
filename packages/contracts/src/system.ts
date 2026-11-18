import { z } from "zod";

// Admin home: whether each part of the platform is running. Built from cheap checks made on each
// request, plus the worker's heartbeat, so it reflects this moment, not a stored history.

const Up = z.enum(["UP", "DOWN"]);

// A process we deploy: the server answering this request, or the worker beating its heartbeat.
const ProcessStatus = z.object({
  status: Up,
  commit: z.string().nullable().meta({
    description: "The deployed git commit; null when running locally (no deploy sets it).",
  }),
  startedAt: z.iso.datetime().nullable().meta({ description: "Null when the process is down." }),
  lastSeenAt: z.iso.datetime().nullable(),
});

// Something the server talks to: Postgres or one of the two Redis instances.
const DependencyStatus = z.object({
  status: Up,
  latencyMs: z
    .int()
    .nullable()
    .meta({ description: "Round trip of a trivial command; null when it didn't answer in time." }),
});

export const SystemStatus = z
  .object({
    checkedAt: z.iso.datetime(),
    server: ProcessStatus,
    worker: ProcessStatus,
    database: DependencyStatus,
    queue: DependencyStatus.meta({ description: "The Redis that holds jobs and rate limits." }),
    cache: DependencyStatus.meta({ description: "The Redis used as a cache (can evict keys)." }),
  })
  .meta({ id: "SystemStatus" });

// One minute of history, recorded by the server: what it measured, and whether the worker's
// heartbeat was there. A minute with no sample means no server was running to take it.
export const SystemSample = z
  .object({
    at: z.iso.datetime().meta({ description: "The start of the minute it was taken in." }),
    worker: Up,
    database: DependencyStatus,
    queue: DependencyStatus,
    cache: DependencyStatus,
  })
  .meta({ id: "SystemSample" });

export const SystemHistory = z
  .object({
    samples: z.array(SystemSample).meta({ description: "Oldest first, up to the last 24 hours." }),
  })
  .meta({ id: "SystemHistory" });

export type SystemStatus = z.infer<typeof SystemStatus>;
export type SystemSample = z.infer<typeof SystemSample>;
export type SystemHistory = z.infer<typeof SystemHistory>;

// Every background queue (PR 2.6), for the admin's Jobs card.
export const QUEUE_NAMES = [
  "slot-generation",
  "slot-maintenance",
  "venue-photo-sweeper",
  "customer-avatar-sweeper",
] as const;
export const QueueName = z.enum(QUEUE_NAMES).meta({ id: "QueueName" });

export const JobsStatus = z
  .object({
    queues: z.array(
      z.object({
        name: QueueName,
        waiting: z.int(),
        active: z.int(),
        delayed: z.int(),
        failed: z.int(),
        oldestWaitingAt: z.iso
          .datetime()
          .nullable()
          .meta({ description: "When the job waiting longest was queued; null when none wait." }),
      }),
    ),
    lastRuns: z
      .object({
        rollForward: z.iso.datetime().nullable(),
        audit: z.iso.datetime().nullable(),
        checks: z.iso.datetime().nullable(),
      })
      .meta({ description: "When slot generation's nightly runs and checks last finished." }),
    failed: z
      .array(
        z.object({
          queue: QueueName,
          id: z.string(),
          name: z.string(),
          groundId: z.uuid().nullable().meta({ description: "For a slot generation run." }),
          reason: z.string(),
          attempts: z.int(),
          failedAt: z.iso.datetime().nullable(),
        }),
      )
      .meta({
        description: "Jobs that failed on their last attempt, newest first, up to 20 a queue.",
      }),
  })
  .meta({ id: "JobsStatus" });

export type QueueName = z.infer<typeof QueueName>;
export type JobsStatus = z.infer<typeof JobsStatus>;
