import { Queue } from "bullmq";
import { queueConnection } from "@/lib/redis";

export type BookingJobs = {
  expire: { bookingId: string };
  complete: { bookingId: string };
};

export type BookingJobName = keyof BookingJobs;

export const BOOKINGS_QUEUE = "bookings";

export const bookingsQueue = new Queue<BookingJobs[BookingJobName], void, BookingJobName>(BOOKINGS_QUEUE, {
  connection: queueConnection,
});
