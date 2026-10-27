import type { Redis } from "ioredis";
import { prisma } from "@/platform/db/prisma";
import { isShuttingDown, markShuttingDown } from "@/platform/lifecycle/state";
import { logger } from "@/platform/logger/logger";
import { cache, queueConnection } from "@/platform/redis/connections";

// Railway sends SIGKILL RAILWAY_DEPLOYMENT_DRAINING_SECONDS (30, set in .railway/railway.ts) after
// SIGTERM. Finish before that, or give up and exit non-zero so it shows in the logs.
const GRACE_MS = 25_000;

const closeRedis = async (client: Redis) => {
  // quit() waits for pending replies; a client that never connected or is reconnecting has none.
  if (client.status === "ready") await client.quit();
  else client.disconnect();
};

// Shuts the process down in order: stop taking new work, let in-flight work finish, then close
// the connections that work was using.
export const handleShutdown = (stopIntake: () => Promise<void>) => {
  const shutdown = async (signal: NodeJS.Signals) => {
    if (isShuttingDown()) return;
    markShuttingDown();
    logger.info({ signal }, "shutting down");

    setTimeout(() => {
      logger.error({ graceMs: GRACE_MS }, "shutdown timed out");
      process.exit(1);
    }, GRACE_MS).unref();

    try {
      await stopIntake();
      await Promise.all([prisma.$disconnect(), closeRedis(queueConnection), closeRedis(cache)]);
      logger.info("shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGTERM", (signal) => void shutdown(signal));
  process.on("SIGINT", (signal) => void shutdown(signal));

  // The process is in an unknown state: log it in our format and let Railway restart us.
  const crash = (err: unknown) => {
    logger.fatal({ err }, "crashed");
    process.exit(1);
  };
  process.on("uncaughtException", crash);
  process.on("unhandledRejection", crash);
};
