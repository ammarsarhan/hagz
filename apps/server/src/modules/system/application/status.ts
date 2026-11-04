import type { SystemStatus } from "@hagz/contracts";
import { buildInfo } from "@/platform/deploy/info";
import { prisma } from "@/platform/db/prisma";
import { cache } from "@/platform/redis/connections";
import { guardedRedis } from "@/platform/redis/guarded";
import { readWorkerHeartbeat } from "./heartbeat";

// Long enough for a slow but working dependency, short enough that a dead one doesn't hold the page.
const CHECK_TIMEOUT_MS = 1_500;

const withTimeout = async <T>(work: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("timed out"));
    }, CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timedOut]);
  } finally {
    clearTimeout(timer);
  }
};

const timed = async (probe: () => Promise<unknown>) => {
  const started = performance.now();
  try {
    await withTimeout(probe());
    return { status: "UP" as const, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { status: "DOWN" as const, latencyMs: null };
  }
};

// The checks behind both the live status and the history samples.
export const runChecks = async () => {
  const [database, queue, cacheCheck, heartbeat] = await Promise.all([
    timed(() => prisma.$queryRaw`SELECT 1`),
    timed(() => guardedRedis((redis) => redis.ping())),
    // The cache connects on first use, so this also opens it the first time.
    timed(() => cache.ping()),
    withTimeout(readWorkerHeartbeat()).catch(() => null),
  ]);
  return { database, queue, cache: cacheCheck, heartbeat };
};

export const systemStatus = async (now = new Date()): Promise<SystemStatus> => {
  const { database, queue, cache: cacheCheck, heartbeat } = await runChecks();
  return {
    checkedAt: now.toISOString(),
    // Answering this request is proof enough that the server is up.
    server: {
      status: "UP",
      commit: buildInfo.commit,
      startedAt: buildInfo.startedAt.toISOString(),
      lastSeenAt: now.toISOString(),
    },
    worker: heartbeat
      ? {
          status: "UP",
          commit: heartbeat.commit,
          startedAt: heartbeat.startedAt,
          lastSeenAt: heartbeat.at,
        }
      : { status: "DOWN", commit: null, startedAt: null, lastSeenAt: null },
    database,
    queue,
    cache: cacheCheck,
  };
};
