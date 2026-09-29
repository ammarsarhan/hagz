import type { Worker } from "bullmq";
import { env } from "@/config/env";
import { queueConnection } from "@/lib/redis";

// Register workers here, e.g. new Worker(name, processor, { connection: queueConnection }).
const workers: Worker[] = [];

console.log(`[worker] started ${workers.length} worker(s) (${env.APP_ENV})`);

const shutdown = async () => {
  await Promise.all(workers.map((w) => w.close()));
  await queueConnection.quit();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
