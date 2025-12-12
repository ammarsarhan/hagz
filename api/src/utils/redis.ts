import Redis from "ioredis";

const globalRedis = globalThis as unknown as { redis: Redis | undefined };

export const redis = globalRedis.redis ?? new Redis({
  host: "localhost",
  port: 6379,
  password: process.env.REDIS_PASSWORD!,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

if (process.env.NODE_ENV !== "production") {
  globalRedis.redis = redis;
}

export default redis;