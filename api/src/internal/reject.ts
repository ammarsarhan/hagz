import PitchService from "@/domains/pitches/services/pitches.service.js";

const pitchId = process.argv[2];
const reason = process.argv[3];

if (!pitchId) {
    console.log("No pitch ID argument was provided. Usage: npm run pitch:reject <pitchId> \"<reason>\"");
    process.exit(1);
}

if (!reason || !reason.trim()) {
    console.log("No rejection reason argument was provided. Usage: npm run pitch:reject <pitchId> \"<reason>\"");
    process.exit(1);
}

console.log(`Started pitch rejection script for pitch ID: ${pitchId}...`);

try {
    await PitchService.rejectPitch(pitchId, reason.trim());
    console.log(`Successfully rejected pitch ${pitchId} and returned it to DRAFT with reason: "${reason.trim()}".`);
} catch (error: any) {
    console.error(`Failed to reject pitch: ${error.message}`);
    process.exit(1);
}

process.exit(0);
