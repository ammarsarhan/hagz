import { queueConnection } from "@/platform/redis/connections";

// Empties this worker's Redis database (each worker has its own, see test/setup.ts).
export const resetRedis = async () => {
  await queueConnection.flushdb();
};

// Deletes keys by pattern within this worker's database, e.g. to skip a cooldown mid-test.
export const deleteRedisKeys = async (...patterns: string[]) => {
  for (const pattern of patterns) {
    let cursor = "0";
    do {
      const [next, keys] = await queueConnection.scan(cursor, "MATCH", pattern, "COUNT", 500);
      cursor = next;
      if (keys.length > 0) await queueConnection.del(...keys);
    } while (cursor !== "0");
  }
};
