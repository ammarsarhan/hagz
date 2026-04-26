import { Redis } from "ioredis";

const global = globalThis as unknown as {
    redis: {
        producer: Redis;
        consumer: Redis;
    } | undefined;
};

export const redis = global.redis ?? {
    producer: new Redis(process.env.REDIS_URL!),
    consumer: new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
};

if (process.env.NODE_ENV !== "production") {
    global.redis = redis;
};
