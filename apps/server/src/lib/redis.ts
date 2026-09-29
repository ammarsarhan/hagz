import { Redis } from "ioredis";
import { env } from "@/config/env";

// BullMQ only. This instance must run with maxmemory-policy noeviction.
export const queueConnection = new Redis(env.REDIS_QUEUE_URL, { maxRetriesPerRequest: null });

// Cache only. This instance runs with allkeys-lru, so anything here can disappear.
export const cache = new Redis(env.REDIS_CACHE_URL);
