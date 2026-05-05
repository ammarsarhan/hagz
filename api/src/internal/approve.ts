import PitchService from "@/domains/pitches/pitches.service.js";

const service = new PitchService();
const pitchId = process.argv[2];

console.log(`Started pitch approving simulation script...`);
await service.approvePitch(pitchId);
console.log(`Done.`);