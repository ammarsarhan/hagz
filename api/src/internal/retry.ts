import GroundService from "@/domains/pitches/services/grounds.service.js";
import { slotsQueue } from "@/jobs/queues/slots.queue.js";

const scheduleId = process.argv[2];

if (!scheduleId) {
    console.log("No schedule argument was provided. Exiting gracefully...");
    process.exit(0);
}

console.log(`Started schedule retrying script...`);
await GroundService.enqueueRetrySlotGeneration(scheduleId);

// Drain and close the queue connection so the script can exit cleanly without killing jobs in flight. The worker runs separately.
await slotsQueue.close();
process.exit(0);