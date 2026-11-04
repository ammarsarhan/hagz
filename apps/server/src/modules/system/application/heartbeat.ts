import { buildInfo } from "@/platform/deploy/info";
import { logger } from "@/platform/logger/logger";
import { guardedRedis } from "@/platform/redis/guarded";

// The worker proves it's alive by writing this key every few seconds, with an expiry a few beats
// long: when the key is gone, the worker is down (crashed, hung, or not deployed). It lives in the
// queue Redis, which never evicts keys, so a missing key means a missing worker, not memory pressure.
const KEY = "heartbeat:worker";
const BEAT_MS = 10_000;
const EXPIRES_SECONDS = 30;

export interface WorkerHeartbeat {
  commit: string | null;
  startedAt: string;
  at: string;
}

const beat = () =>
  guardedRedis((redis) => {
    const value: WorkerHeartbeat = {
      commit: buildInfo.commit,
      startedAt: buildInfo.startedAt.toISOString(),
      at: new Date().toISOString(),
    };
    return redis.set(KEY, JSON.stringify(value), "EX", EXPIRES_SECONDS);
  }).catch((err: unknown) => {
    // Redis down: the key expires and the admin home shows the worker as down, which is true enough.
    logger.warn({ err }, "worker heartbeat not written");
  });

// Starts beating now and every BEAT_MS; the returned function stops and removes the key, so a clean
// shutdown shows as down at once instead of after the expiry.
export const startWorkerHeartbeat = () => {
  void beat();
  const timer = setInterval(() => void beat(), BEAT_MS);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await guardedRedis((redis) => redis.del(KEY)).catch(() => undefined);
  };
};

export const readWorkerHeartbeat = async (): Promise<WorkerHeartbeat | null> => {
  const raw = await guardedRedis((redis) => redis.get(KEY));
  return raw ? (JSON.parse(raw) as WorkerHeartbeat) : null;
};
