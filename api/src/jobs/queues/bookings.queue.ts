import { Queue } from "bullmq";
import { redis } from "@/shared/lib/utils/redis.js";
import type { BookingJobPayload } from "@/shared/types/bookings.js";

export const bookingsQueue = new Queue<BookingJobPayload>("bookings", {
    connection: redis
});
