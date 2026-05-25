import { Worker } from "bullmq";
import { Redis } from "ioredis";
import prisma from "@/shared/lib/utils/prisma.js";
import { ERROR_CODES, InternalServerError } from "@/shared/lib/utils/error.js";
import { PitchStatus, PriceType, ScheduleStatus, SlotStatus } from "@/generated/prisma/enums.js";
import { addDays } from "date-fns";
import { GroundSlotEvent, type GroundSlotJobPayload } from "@/shared/types/slots.js";
import { slotsQueue } from "../queues/slots.queue.js";

const slotsWorker = new Worker<GroundSlotJobPayload>("slots", 
    async (job) => {
        switch (job.data.event) {
            case GroundSlotEvent.GENERATE:
                return await handleGenerateSlots(job.data);
            case GroundSlotEvent.EXTEND:
                return await handleExtendSlots(job.data);
            case GroundSlotEvent.ADJUST:
                return await handleAdjustSlots(job.data);
        }
    },
    {
        connection: new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null }),
        removeOnComplete: { count: 0 },
        removeOnFail: { count: 50 }
    }
);

type GenerateSlotType = { 
    startsAt: Date; 
    priceType: PriceType 
};

export async function handleGenerateSlots({ pitchId, groundId }: GroundSlotJobPayload) {
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
                
                const hours: Array<GenerateSlotType> = [];

                for (let h = 0; h < 24; h++) {
                    // Fixed MSB and LSB flipping issue.
                    const bit = 1 << h;
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

export async function handleExtendSlots({ groundId, pitchId }: GroundSlotJobPayload) {
    const settings = await prisma.groundSettings.findUnique({ where: { groundId } });

    if (!settings) throw new InternalServerError(
        "Could not find settings associated with the specified ground.",
        ERROR_CODES.GROUND_SETTINGS_MISSING
    );

    const schedules = await prisma.schedule.findMany({ where: { groundId } });

    if (schedules.length !== 7) throw new InternalServerError(
        "Ground schedule contains less than or more than 7 day records.",
        ERROR_CODES.GROUND_SCHEDULE_MISSING
    );

    const now = new Date();
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Prune slots older than 30 days.
    const pruneThreshold = addDays(utcMidnight, -30);
    const pruned = await prisma.groundSlot.deleteMany({
        where: { groundId, startsAt: { lt: pruneThreshold } },
    });
    
    console.log(`[slots-worker] Pruned ${pruned.count} stale slots for ground ${groundId}.`);

    // Find the furthest existing slot and collect all missing dates up to the window end.
    const lastSlot = await prisma.groundSlot.findFirst({
        where: { groundId },
        orderBy: { startsAt: "desc" },
    });

    const startFrom = lastSlot
        ? addDays(new Date(Date.UTC(
            lastSlot.startsAt.getUTCFullYear(),
            lastSlot.startsAt.getUTCMonth(),
            lastSlot.startsAt.getUTCDate(),
        )), 1)
        : utcMidnight;

    const windowEnd = addDays(utcMidnight, Math.ceil(settings.maximumWindow / 24));

    const missingDates: Date[] = [];
    let cursor = startFrom;
    
    while (cursor < windowEnd) {
        missingDates.push(cursor);
        cursor = addDays(cursor, 1);
    }

    if (missingDates.length === 0) {
        console.log(`[slots-worker] No missing dates to extend for ground ${groundId}.`);
        return;
    }

    // Group missing dates by day-of-week and generate slots for each.
    const slots: Array<GenerateSlotType & { startsAt: Date }> = [];

    for (const date of missingDates) {
        const targetDayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
        const schedule = schedules.find(s => s.dayOfWeek === targetDayOfWeek);

        if (!schedule) {
            console.warn(`[slots-worker] No schedule found for dayOfWeek ${targetDayOfWeek}, skipping ${date.toISOString()}.`);
            continue;
        }

        if (schedule.status !== ScheduleStatus.READY) {
            console.warn(`[slots-worker] Schedule for dayOfWeek ${targetDayOfWeek} is not ready (${schedule.status}), skipping ${date.toISOString()}.`);
            continue;
        }

        const baseMask     = Buffer.from(schedule.baseHours).readUIntBE(0, 3);
        const peakMask     = Buffer.from(schedule.peakHours).readUIntBE(0, 3);
        const discountMask = Buffer.from(schedule.discountHours).readUIntBE(0, 3);

        for (let h = 0; h < 24; h++) {
            const bit = 1 << h;
            const startsAt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h));

            if      (peakMask & bit)     slots.push({ startsAt, priceType: PriceType.PEAK });
            else if (discountMask & bit) slots.push({ startsAt, priceType: PriceType.DISCOUNT });
            else if (baseMask & bit)     slots.push({ startsAt, priceType: PriceType.BASE });
        }
    }

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

    console.log(`[slots-worker] Extended slots for ground ${groundId}. Added ${slots.length} slots across ${missingDates.length} days.`);
};

export async function handleAdjustSlots({ groundId, pitchId, dayOfWeek }: GroundSlotJobPayload) {
    const settings = await prisma.groundSettings.findUnique({ where: { groundId } });
    
    if (!settings) throw new InternalServerError(
        "Could not find settings associated with the specified ground.",
        ERROR_CODES.GROUND_SETTINGS_MISSING
    );

    // Fetch only schedules that were recently upserted (GENERATING acts as a dirty flag,
    // but here we adjust all — caller should mark them or pass dayOfWeek in the payload if targeted).
    const schedules = await prisma.schedule.findMany({ 
        where: { 
            groundId,
            ...(dayOfWeek !== undefined && { dayOfWeek }),
        } 
    });

    // Update the pitch to be under maintenance while we are adjusting the slots.
    const pitch = await prisma.pitch.findUnique({ where: { id: pitchId, status: { not: PitchStatus.DELETED } }, select: { status: true } });

    if (!pitch) {
        console.error("Could not find pitch. Unable to adjust slots.")
        return;
    };

    const status = pitch.status ?? PitchStatus.LIVE;

    await prisma.pitch.update({
        where: { id: pitchId },
        data: { status: PitchStatus.MAINTENANCE }
    });

    // Start the actual slot adjusting block.
    const now = new Date();
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const limit = Math.ceil(settings.maximumWindow / 24);
    const dates = Array.from({ length: limit }, (_, i) => addDays(utcMidnight, i));

    try {
        for (const schedule of schedules) {
            try {
                await prisma.schedule.update({
                    where: { groundId_dayOfWeek: { groundId, dayOfWeek: schedule.dayOfWeek } },
                    data: { status: ScheduleStatus.GENERATING },
                });
    
                // Delete only future AVAILABLE slots for this day-of-week.
                // Booked/past slots are left untouched.
                const futureDates = dates.filter(d => {
                    const day = d.getUTCDay();
                    const normalized = schedule.dayOfWeek === 7 ? 0 : schedule.dayOfWeek;
                    return day === normalized;
                });
    
                if (futureDates.length === 0) continue;
    
                await prisma.groundSlot.deleteMany({
                    where: {
                        groundId,
                        status: SlotStatus.AVAILABLE,
                        startsAt: {
                            in: futureDates.map(date => 
                                Array.from({ length: 24 }, (_, h) =>
                                    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h))
                                )
                            ).flat(),
                        },
                    },
                });
    
                // Regenerate with the updated schedule config.
                const baseMask     = Buffer.from(schedule.baseHours).readUIntBE(0, 3);
                const peakMask     = Buffer.from(schedule.peakHours).readUIntBE(0, 3);
                const discountMask = Buffer.from(schedule.discountHours).readUIntBE(0, 3);
    
                const slots = futureDates.flatMap(date => {
                    const hours: Array<GenerateSlotType> = [];
                    for (let h = 0; h < 24; h++) {
                        const bit = 1 << h;
                        const startsAt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h));
    
                        if      (peakMask & bit)     hours.push({ startsAt, priceType: PriceType.PEAK });
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
                    data: { status: ScheduleStatus.READY },
                });
    
                await slotsQueue.remove(`slots-${groundId}-adjust-${dayOfWeek}`);
    
                console.log(`[slots-worker] Adjusted slots for ground ${groundId}, dayOfWeek ${schedule.dayOfWeek}.`);
            } catch (err) {
                await prisma.schedule.update({
                    where: { groundId_dayOfWeek: { groundId, dayOfWeek: schedule.dayOfWeek } },
                    data: { status: ScheduleStatus.FAILED },
                });
                throw err;
            }
        }
    } finally {
        await prisma.pitch.update({ where: { id: pitchId }, data: { status } });
    }

    console.log(`[slots-worker] Finished adjusting slots for ground ${groundId}.`);
};

// Handle failing and log for manual resolving.
slotsWorker.on("failed", async (job, err) => {
    if (!job) return;
    console.error(`[slots-worker] job ${job.id} (${job.name}) failed for ground ${job.data.groundId}:`, err.message);
});
