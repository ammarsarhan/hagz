import type { Job } from "bullmq";
import { StaleTransitionError, transitionBooking } from "@/domain/bookings/transitions";
import type { BookingJobName, BookingJobs } from "@/jobs/queues";

// Automatic transitions. If a person already moved the booking on, the transition is stale and the job exits quietly.
export const processBookingJob = async (job: Job<BookingJobs[BookingJobName], void, BookingJobName>) => {
  const { bookingId } = job.data;

  try {
    if (job.name === "expire") {
      await transitionBooking({ bookingId, from: "pending", to: "expired", actor: "system" });
    } else if (job.name === "complete") {
      await transitionBooking({ bookingId, from: "confirmed", to: "completed", actor: "system" });
    }
  } catch (error) {
    if (error instanceof StaleTransitionError) return;
    throw error;
  }
};
