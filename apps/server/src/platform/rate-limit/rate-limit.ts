import { createHash } from "node:crypto";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { env } from "@/platform/config/env";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { queueConnection } from "@/platform/redis/connections";

// Fixed-window counters in Redis, the same design as Terhal's limiter. A burst of up to twice the
// limit is possible across a window boundary; for the auth limits this guards, that's acceptable.
export interface Limit {
  // What is being limited and against what, e.g. "otp:send:phone". Part of the key.
  name: string;
  limit: number;
  windowMs: number;
  // Fail closed by default: when the limit guards money or accounts (codes, logins, invite codes),
  // an unreachable Redis must not mean unlimited attempts. Fail open only where availability wins.
  failOpen?: boolean;
}

// One script, so concurrent requests can't slip past the limit. The first request creates the counter
// with the window as its expiry; a counter that somehow lost its expiry gets it back.
const consumeScript = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

// The queue connection, never the cache: the cache evicts keys under memory pressure, which would
// silently reset counters. That connection queues commands while Redis is down (BullMQ needs that),
// so check its state and cap the wait instead of hanging until the request times out.
const REDIS_TIMEOUT_MS = 500;

const count = async (key: string, windowMs: number): Promise<{ count: number; ttl: number }> => {
  if (queueConnection.status !== "ready") throw new Error(`Redis is ${queueConnection.status}`);
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Redis timed out"));
    }, REDIS_TIMEOUT_MS);
  });
  try {
    const [current, ttl] = (await Promise.race([
      queueConnection.eval(consumeScript, 1, key, windowMs),
      timedOut,
    ])) as [number, number];
    return { count: current, ttl };
  } finally {
    clearTimeout(timer);
  }
};

// Values are hashed, so Redis never holds raw phone numbers or IPs. Callers pass normalized values
// (E.164 phones): +20 100 ..., 0100... and +20100... must be one counter, not three.
const keyFor = (name: string, value: string) =>
  `ratelimit:${name}:${createHash("sha256").update(value).digest("base64url")}`;

// Counts one attempt against `value` under `limit`, and throws 429 when it's over.
export const consume = async (limit: Limit, value: string): Promise<void> => {
  let result: { count: number; ttl: number };
  try {
    result = await count(keyFor(limit.name, value), limit.windowMs);
  } catch (error) {
    if (limit.failOpen) {
      logger.warn({ err: error, limit: limit.name }, "rate limiter unavailable, failing open");
      return;
    }
    logger.error({ err: error, limit: limit.name }, "rate limiter unavailable, failing closed");
    throw new AppError({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      detail: "This service is temporarily unavailable. Please try again shortly.",
    });
  }

  if (result.count > limit.limit) {
    const retryAfter = Math.max(1, Math.ceil(result.ttl / 1000));
    throw new AppError({
      code: "RATE_LIMITED",
      status: 429,
      detail: "Too many attempts. Please wait before trying again.",
      extensions: { retryAfter },
      headers: { "Retry-After": String(retryAfter) },
    });
  }
};

export const clientIp = (c: Context): string => {
  const forwarded = env.CLIENT_IP_HEADER ? c.req.header(env.CLIENT_IP_HEADER)?.trim() : undefined;
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // No socket (e.g. router.request() in tests).
    return "unknown";
  }
};

// Per-IP limit as middleware, for routes where the caller is all we know. Per-phone limits run inside
// the use case, after the number is normalized.
export const limitByIp = (limit: Limit) =>
  createMiddleware(async (c, next) => {
    await consume(limit, clientIp(c));
    await next();
  });
