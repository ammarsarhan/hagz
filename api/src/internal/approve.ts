import PitchService from "@/domains/pitches/services/pitches.service.js";
import { slotsQueue } from "@/jobs/queues/slots.queue.js";

const pitchId = process.argv[2];

if (!pitchId) {
    console.log("No pitch argument was provided. Exiting gracefully...");
    process.exit(0);
}

console.log(`Started pitch approval script...`);
await PitchService.approvePitch(pitchId);

// Drain and close the queue connection so the script can exit cleanly without killing jobs in flight. The worker runs separately.
await slotsQueue.close();
process.exit(0);