import { Worker } from "bullmq";
import { Redis } from "ioredis";
import prisma from "@/shared/lib/utils/prisma.js";
import { PitchEvent, type PitchJobPayload } from "@/shared/types/pitches.js";

const pitchesWorker = new Worker<PitchJobPayload>("pitches", 
    async (job) => {
        try {
            switch (job.data.event) {
                case PitchEvent.EXPIRE_BOOKING:
                    {
                        const { pitchId } = job.data;
                        await prisma.pitch.update({
                            where: { id: pitchId },
                            data: {
                                weeklyBookings: { decrement: 1 }
                            }
                        });
                        break;
                    }
            }
        } catch (error: any) {
            console.error(`[pitches-worker] job ${job.id} failed:`, error.message);
        }
    },
    { 
        connection: new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
    }
);

pitchesWorker.on("failed", (job, err) => {
    if (!job) return;
    console.error(`[pitches-worker] job ${job.id} (${job.name}) failed:`, err.message);
});
