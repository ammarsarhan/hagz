import { queueConnection } from "@/platform/redis/connections";

// Deletes keys by pattern (e.g. "otp:*"). Redis is shared by every worker, so only use patterns this
// file owns.
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
