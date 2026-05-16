import PitchService from "@/domains/pitches/services/pitches.service.js";
import { slotsQueue } from "@/jobs/queues/slots.queue.js";

const service = new PitchService();
const pitchId = process.argv[2];

if (!pitchId) {
    console.log("No pitch argument was provided. Exiting gracefully...");
    process.exit(0);
}

console.log(`Started pitch approving simulation script...`);
await service.approvePitch(pitchId);

// Drain and close the queue connection so the script can exit cleanly without killing jobs in flight. The worker runs separately.
await slotsQueue.close();
process.exit(0);