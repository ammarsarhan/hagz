import type { QueueName } from "@hagz/contracts";
import { Worker } from "bullmq";
import { createQueue } from "@/platform/jobs/queues";
import { logger } from "@/platform/logger/logger";
import { queueConnection } from "@/platform/redis/connections";
import { completeEndedBookings } from "../application/complete-bookings";
import { expireDueBookings } from "../application/expire-bookings";
import { topUpAllVenues } from "../application/regulars";

// Every minute (PR 4.2): expires unapproved and unpaid bookings, releases regulars' weeks nobody
// confirmed, and completes confirmed games that have ended. Daily (PR 4.5), after the nightly slot
// roll-forward: tops up every regular's reservations to the horizon. Schedulers are upserts, so every
// worker can register them without making a second; every job is idempotent.
const QUEUE: QueueName = "booking-expiry";
const EVERY_MINUTE_MS = 60 * 1000;
// Cairo's small hours, after slot generation's 01:00 roll-forward has made the new week's slots.
const DAILY = { pattern: "15 2 * * *", tz: "Africa/Cairo" };

export const startBookingExpiry = async () => {
  const queue = createQueue(QUEUE);
  await queue.upsertJobScheduler("sweep", { every: EVERY_MINUTE_MS }, { name: "sweep" });
  await queue.upsertJobScheduler("regulars", DAILY, { name: "regulars" });
  const worker = new Worker(
    QUEUE,
    async (job) => {
      if (job.name === "regulars") {
        const venues = await topUpAllVenues();
        logger.info({ venues }, "topped up regulars' reservations");
        return;
      }
      const expired = await expireDueBookings();
      if (expired > 0)
        logger.info(
          { expired },
          "expired unapproved or unpaid bookings, or released unanswered weeks",
        );
      const completed = await completeEndedBookings();
      if (completed > 0) logger.info({ completed }, "completed ended games");
    },
    { connection: queueConnection },
  );
  return { worker, queue };
};
