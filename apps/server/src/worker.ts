import { Worker } from "bullmq";
import { env } from "@/config/env";
import { processBookingJob } from "@/jobs/bookings";
import { BOOKINGS_QUEUE } from "@/jobs/queues";
import { queueConnection } from "@/lib/redis";

const workers = [new Worker(BOOKINGS_QUEUE, processBookingJob, { connection: queueConnection })];

console.log(`[worker] started ${workers.length} worker(s) (${env.APP_ENV})`);

const shutdown = async () => {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
