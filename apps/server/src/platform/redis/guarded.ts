import { AppError } from "@/platform/errors/app-error";
import { queueConnection } from "@/platform/redis/connections";

// The queue connection queues commands while Redis is down (BullMQ needs that), so a plain call would
// hang until the request times out. Check the state and cap the wait instead. Used for state that must
// not be lost or bypassed (rate limits, one-time codes), so failure is a 503, not a skipped check.
const TIMEOUT_MS = 500;

export class RedisUnavailableError extends Error {}

export const guardedRedis = async <T>(
  command: (redis: typeof queueConnection) => Promise<T>,
): Promise<T> => {
  if (queueConnection.status !== "ready") {
    throw new RedisUnavailableError(`Redis is ${queueConnection.status}`);
  }
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RedisUnavailableError("Redis timed out"));
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([command(queueConnection), timedOut]);
  } finally {
    clearTimeout(timer);
  }
};

export const serviceUnavailable = () =>
  new AppError({
    code: "SERVICE_UNAVAILABLE",
    status: 503,
    detail: "This service is temporarily unavailable. Please try again shortly.",
  });
