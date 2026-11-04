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

export type SystemStatus = z.infer<typeof SystemStatus>;
