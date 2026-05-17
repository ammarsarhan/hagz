import { Worker } from "bullmq";
import { redis } from "@/shared/lib/utils/redis.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { ERROR_CODES, InternalServerError } from "@/shared/lib/utils/error.js";
import { PriceType, ScheduleStatus, SlotStatus } from "@/generated/prisma/enums.js";
import { addDays } from "date-fns";
import { GroundSlotAction } from "@/shared/types/slots.js";

const slotsWorker = new Worker("slots", 
    async (job) => {
        switch (job.name) {
            case GroundSlotAction.GENERATE:
                return await handleGenerateSlots(job.data);
            case GroundSlotAction.EXTEND:
                return await handleExtendSlots(job.data);
            case GroundSlotAction.ADJUST:
                return await handleAdjustSlots(job.data);
        }
    },
    { connection: redis.consumer }
);

interface GenerateSlotsPayload {
    groundId: string;
    pitchId: string;
};

type SlotPayloadType = { 
    startsAt: Date; 
    priceType: PriceType 
};

export async function handleGenerateSlots({ pitchId, groundId }: GenerateSlotsPayload) {
    const settings = await prisma.groundSettings.findUnique({ where: { groundId } });
    if (!settings) throw new InternalServerError("Could not find settings associated with the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);
    
    const { maximumWindow } = settings;

    const schedules = await prisma.schedule.findMany({ where: { groundId } });
    if (schedules.length !== 7) throw new InternalServerError("Ground schedule contains less than or more than 7 day records.", ERROR_CODES.GROUND_SCHEDULE_MISSING);

    const now = new Date();
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const limit = Math.ceil(maximumWindow / 24);
    const dates = Array.from({ length: limit }, (_, i) => addDays(utcMidnight, i));

    for (const schedule of schedules) {
        try {
            await prisma.schedule.update({
                where: { groundId_dayOfWeek: { groundId, dayOfWeek: schedule.dayOfWeek } },
                data: { status: ScheduleStatus.GENERATING }
            });

            console.log(`[slots-worker] Started generating for Day ${schedule.dayOfWeek}.`);

            const target = dates.filter(d => {
                const day = d.getUTCDay();
                const normalized = schedule.dayOfWeek === 7 ? 0 : schedule.dayOfWeek;
                return day === normalized;
            });

            const baseMask = Buffer.from(schedule.baseHours).readUIntBE(0, 3);
            const peakMask = Buffer.from(schedule.peakHours).readUIntBE(0, 3);
            const discountMask = Buffer.from(schedule.discountHours).readUIntBE(0, 3);

            const slots = target.flatMap(date => {
                console.log(`[slots-worker] [${new Date().toLocaleDateString()}] Generating slots on ground ${groundId} for ${date.toISOString()}.`);
                
                const hours: Array<SlotPayloadType> = [];

                for (let h = 0; h < 24; h++) {
                    const bit = 1 << (23 - h);
                    // Build timestamp purely in UTC to stop time drift issues.
                    const startsAt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h));

                    if (peakMask & bit)          hours.push({ startsAt, priceType: PriceType.PEAK });
                    else if (discountMask & bit) hours.push({ startsAt, priceType: PriceType.DISCOUNT });
                    else if (baseMask & bit)     hours.push({ startsAt, priceType: PriceType.BASE });
                }

                return hours;
            });

            await prisma.groundSlot.createMany({
                data: slots.map(({ startsAt, priceType }) => ({
                    groundId,
                    pitchId,
                    startsAt,
                    priceType,
                    status: SlotStatus.AVAILABLE,
                })),
                skipDuplicates: true,
            });

            await prisma.schedule.update({
                where: { groundId_dayOfWeek: { groundId, dayOfWeek: schedule.dayOfWeek } },
                data: { status: ScheduleStatus.READY }
            });

            console.log(`[slots-worker] Finished generating for Day ${schedule.dayOfWeek}.`);
        } catch (err) {
            await prisma.schedule.update({
                where: { groundId_dayOfWeek: { groundId, dayOfWeek: schedule.dayOfWeek } },
                data: { status: ScheduleStatus.FAILED }
            });
            throw err;
        }
    }

    console.log(`[slots-worker] [${new Date().toLocaleDateString()}] Finished slot generation for ground ${groundId}.`);
};

export async function handleExtendSlots({ groundId }: GenerateSlotsPayload) {
    
};

export async function handleAdjustSlots({ groundId }: GenerateSlotsPayload) {

};

// Handle failing and mark for manual resolving.
slotsWorker.on("failed", async (job, err) => {
    if (!job) return;

    await prisma.schedule.updateMany({
        where: { groundId: job.data.groundId },
        data: { status: ScheduleStatus.FAILED }
    });

    console.error(`[slot-worker] job ${job.id} (${job.name}) failed for ground ${job.data.groundId}:`, err.message);
});
