import type { QueueName } from "@hagz/contracts";
import { Worker } from "bullmq";
import { createQueue } from "@/platform/jobs/queues";
import { logger } from "@/platform/logger/logger";
import { queueConnection } from "@/platform/redis/connections";
import { expireDueBookings } from "../application/expire-bookings";

// Expires unapproved and unpaid bookings every minute (PR 4.2). The scheduler is an upsert, so every
// worker can register it without making a second one; the sweep is idempotent.
const QUEUE: QueueName = "booking-expiry";
const EVERY_MINUTE_MS = 60 * 1000;

export const startBookingExpiry = async () => {
  const queue = createQueue(QUEUE);
  await queue.upsertJobScheduler("sweep", { every: EVERY_MINUTE_MS }, { name: "sweep" });
  const worker = new Worker(
    QUEUE,
    async () => {
      const expired = await expireDueBookings();
      if (expired > 0) logger.info({ expired }, "expired unapproved or unpaid bookings");
    },
    { connection: queueConnection },
  );
  return { worker, queue };
};
