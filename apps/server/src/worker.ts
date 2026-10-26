import type { Worker } from "bullmq";
import { env } from "@/config/env";
import { queueConnection } from "@/lib/redis";

// Register workers here, e.g. new Worker(name, processor, { connection: queueConnection }).
const workers: Worker[] = [];

console.log(`[worker] started ${workers.length} worker(s) (${env.APP_ENV})`);

const shutdown = async () => {
  try {
    await Promise.all(workers.map((w) => w.close()));
    await queueConnection.quit();
    process.exit(0);
  } catch (error) {
    // A rejected close would otherwise be an unhandled rejection and leave the process hanging.
    console.error("[worker] shutdown failed:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
