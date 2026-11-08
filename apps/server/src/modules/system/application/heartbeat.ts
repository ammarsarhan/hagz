import { randomUUID } from "node:crypto";
import { buildInfo } from "@/platform/deploy/info";
import { logger } from "@/platform/logger/logger";
import { guardedRedis } from "@/platform/redis/guarded";

// Each worker proves it's alive by writing its own entry in this sorted set every few seconds: the
// member says which process it is, the score is when it last beat. A worker is alive while its last
// beat is recent; with none recent, the worker is down (crashed, hung, or not deployed). It lives in
// the queue Redis, which never evicts keys, so a missing beat means a missing worker.
//
// One entry per process, not one shared key, because two workers overlap on every deploy (and may
// run as replicas): each one only ever touches its own entry, so a worker shutting down can't erase
// the beat of the one replacing it. Scores are each process's clock; hosts keep theirs in sync, and
// the expiry is a few beats long, so a little skew doesn't matter.
const KEY = "heartbeat:workers";
export const BEAT_MS = 10_000;
const EXPIRES_MS = 30_000;

export interface WorkerHeartbeat {
  commit: string | null;
  startedAt: string;
  at: string;
}

interface Member {
  instance: string;
  commit: string | null;
  startedAt: string;
}

// Fixed for the life of the process, so every beat updates the same member.
const self = JSON.stringify({
  instance: randomUUID(),
  commit: buildInfo.commit,
  startedAt: buildInfo.startedAt.toISOString(),
} satisfies Member);

const beat = () =>
  guardedRedis((redis) => {
    const now = Date.now();
    return (
      redis
        .multi()
        .zadd(KEY, now, self)
        // Workers that stopped without removing themselves (a crash, a kill).
        .zremrangebyscore(KEY, "-inf", now - EXPIRES_MS)
        // With no worker left, the key goes too.
        .pexpire(KEY, EXPIRES_MS)
        .exec()
    );
  }).catch((err: unknown) => {
    // Redis down: the beat goes stale and the admin home shows the worker as down, which is true
    // enough.
    logger.warn({ err }, "worker heartbeat not written");
  });

// Starts beating now and every BEAT_MS; the returned function stops and removes this process's
// entry (and only it), so a clean shutdown shows at once instead of after the expiry.
export const startWorkerHeartbeat = () => {
  void beat();
  const timer = setInterval(() => void beat(), BEAT_MS);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await guardedRedis((redis) => redis.zrem(KEY, self)).catch(() => undefined);
  };
};

// The live worker that started last (the newest deploy), or null when none has beaten recently.
export const readWorkerHeartbeat = async (): Promise<WorkerHeartbeat | null> => {
  const raw = await guardedRedis((redis) =>
    redis.zrangebyscore(KEY, Date.now() - EXPIRES_MS, "+inf", "WITHSCORES"),
  );
  let newest: WorkerHeartbeat | null = null;
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const member = JSON.parse(raw[i] as string) as Member;
    if (newest && member.startedAt <= newest.startedAt) continue;
    newest = {
      commit: member.commit,
      startedAt: member.startedAt,
      at: new Date(Number(raw[i + 1])).toISOString(),
    };
  }
  return newest;
};
