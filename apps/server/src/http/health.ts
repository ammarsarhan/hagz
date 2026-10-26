import { Hono } from "hono";
import { prisma } from "@/platform/db/prisma";
import { isShuttingDown } from "@/platform/lifecycle/state";
import { queueConnection } from "@/platform/redis/connections";

const CHECK_TIMEOUT_MS = 2_000;

const reachable = async (probe: () => Promise<unknown>): Promise<boolean> => {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("health check timed out"));
    }, CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([probe(), timedOut]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

export const health = new Hono()
  // Is the process up? Drives restarts, so it checks nothing else: a database blip must not cause a
  // restart loop.
  .get("/live", (c) => c.json({ status: "ok" }))
  // Can this instance serve requests? Drives traffic and Railway's deploy healthcheck. Only Postgres
  // is required: with Redis down the cache falls back to Postgres and sweepers replace the queue, so
  // Redis is reported but doesn't take the API out of service.
  .get("/ready", async (c) => {
    if (isShuttingDown()) return c.json({ status: "shutting_down" }, 503);

    const database = await reachable(() => prisma.$queryRaw`SELECT 1`);
    // The connection's own state, not a PING: commands to a down Redis queue up instead of failing.
    const queue = queueConnection.status === "ready";

    const checks = { database: database ? "ok" : "down", queue: queue ? "ok" : "down" };
    if (!database) return c.json({ status: "unavailable", checks }, 503);
    return c.json({ status: queue ? "ok" : "degraded", checks });
  });
