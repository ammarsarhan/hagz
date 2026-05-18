import { Redis } from "ioredis";

const global = globalThis as unknown as {
    redis: Redis | undefined;
};

export const redis = global.redis ?? new Redis(process.env.REDIS_URL!);

if (process.env.NODE_ENV !== "production") {
    global.redis = redis;
};
