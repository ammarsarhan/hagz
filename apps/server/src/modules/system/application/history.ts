import type { SystemSample } from "@hagz/contracts";
import { logger } from "@/platform/logger/logger";
import { guardedRedis } from "@/platform/redis/guarded";
import { runChecks } from "./status";

// A minute-by-minute history for the admin home's charts: the last 24 hours, newest first in a list
// in the queue Redis (which never evicts). It's monitoring, not a record: losing it costs a chart.
const KEY = "status:samples";
const KEEP = 24 * 60;
const EVERY_MS = 60_000;

const minuteOf = (date: Date) => new Date(Math.floor(date.getTime() / EVERY_MS) * EVERY_MS);

// Records this minute once, whichever server instance gets there first: the per-minute key is taken
// with NX, so every other instance (and a second call in the same minute) skips it.
export const takeSample = async (now = new Date()): Promise<boolean> => {
  const minute = minuteOf(now);
  const claimed = await guardedRedis((redis) =>
    redis.set(`status:sample:${minute.toISOString()}`, "1", "EX", 120, "NX"),
  );
  if (claimed === null) return false;
  const { database, queue, cache, heartbeat } = await runChecks();
  const sample: SystemSample = {
    at: minute.toISOString(),
    worker: heartbeat ? "UP" : "DOWN",
    database,
    queue,
    cache,
  };
  await guardedRedis((redis) =>
    redis
      .multi()
      .lpush(KEY, JSON.stringify(sample))
      .ltrim(KEY, 0, KEEP - 1)
      .exec(),
  );
  return true;
};

// Starts sampling now and every minute; the returned function stops it.
export const startStatusSampler = () => {
  const sample = () =>
    takeSample().catch((err: unknown) => {
      // Redis down: this minute has no sample, and the chart shows the gap.
      logger.warn({ err }, "status sample not taken");
    });
  void sample();
  const timer = setInterval(() => void sample(), EVERY_MS);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
};

export const readHistory = async (): Promise<SystemSample[]> => {
  const raw = await guardedRedis((redis) => redis.lrange(KEY, 0, KEEP - 1));
  return raw.map((item) => JSON.parse(item) as SystemSample).reverse();
};
