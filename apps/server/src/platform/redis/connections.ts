import { Redis } from "ioredis";
import { env } from "@/platform/config/env";
import { logger } from "@/platform/logger/logger";

// family: 0 resolves both IPv4 and IPv6; Railway's private network can be IPv6 only.

// BullMQ only. This instance must run with maxmemory-policy noeviction.
export const queueConnection = new Redis(env.QUEUE_URL, { family: 0, maxRetriesPerRequest: null });

// Cache only. This instance runs with allkeys-lru, so anything here can disappear. Connects on
// first use, so processes that never touch it (the worker) don't hold a connection.
export const cache = new Redis(env.CACHE_URL, { family: 0, lazyConnect: true });

// ioredis reconnects on its own; without a listener every failed attempt is an unhandled event.
for (const [name, client] of [
  ["queue", queueConnection],
  ["cache", cache],
] as const) {
  client.on("error", (err) => {
    logger.warn({ err, redis: name }, "redis connection error");
  });
}
