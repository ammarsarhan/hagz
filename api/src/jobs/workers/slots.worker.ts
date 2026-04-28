import { Worker } from "bullmq";
import { redis } from "@/shared/lib/redis.js";
import prisma from "@/shared/lib/prisma.js";
import { ERROR_CODES, InternalServerError } from "@/shared/lib/error.js";
import { PriceType, ScheduleStatus, SlotStatus } from "@/generated/prisma/enums.js";
import { addDays, getDay, setHours, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const GroundSlotAction = {
    GENERATE: "GENERATE",
    EXTEND: "EXTEND",
    ADJUST:  "ADJUST",
} as const;

const slotWorker = new Worker("slot", 
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

type SlotPayloadType = { startsAt: Date; priceType: PriceType };

export async function handleGenerateSlots({ pitchId, groundId }: GenerateSlotsPayload) {
    // Fetch the settings and make sure they exist.
    const settings = await prisma.groundSettings.findUnique({ where: { groundId } });
    if (!settings) throw new InternalServerError("Could not find settings associated with the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);
    
    const { maximumWindow } = settings;

    // Fetch the schedule and mark it as generating.
    const schedules = await prisma.schedule.updateManyAndReturn({
        where: { groundId },
        data: { status: ScheduleStatus.GENERATING }
    });

    if (schedules.length !== 7) throw new InternalServerError("Ground schedule contains less than or more than 7 day records.", ERROR_CODES.GROUND_SCHEDULE_MISSING);

    const TIMEZONE = "Africa/Cairo";

    // Parse the data into constraints for now and the generation limit.
    const now = startOfDay(toZonedTime(new Date(), TIMEZONE));
    const limit = Math.ceil(maximumWindow / 24); // Divide by 24 to convert to days.

    const dates = Array.from({ length: limit }, (_, i) => addDays(now, i));

    // Rather than mapping through each schedule and waiting to generate synchronously, do them in parallel.
    await Promise.all(
        schedules.map(async (schedule) => {
            // Generate slots for each matching date.
            const target = dates.filter(d => getDay(d) === schedule.dayOfWeek);
        
            // Parse the masks into a full 24-bit mask per pricing type.
            const baseMask = Buffer.from(schedule.baseHours).readUIntBE(0, 3);
            const peakMask = Buffer.from(schedule.peakHours).readUIntBE(0, 3);
            const discountMask = Buffer.from(schedule.discountHours).readUIntBE(0, 3);

            const slots = target.flatMap(date => {
                const hours: Array<SlotPayloadType> = [];

                for (let h = 0; h < 24; h++) {
                    if (peakMask & (1 << h))          hours.push({ startsAt: setHours(date, h), priceType: PriceType.PEAK });
                    else if (discountMask & (1 << h)) hours.push({ startsAt: setHours(date, h), priceType: PriceType.DISCOUNT });
                    else if (baseMask & (1 << h))     hours.push({ startsAt: setHours(date, h), priceType: PriceType.BASE });
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
                where: { 
                    groundId_dayOfWeek: {
                        groundId,
                        dayOfWeek: schedule.dayOfWeek
                    }
                },
                data: {
                    status: ScheduleStatus.READY
                }
            });
        })
    );
};

export async function handleExtendSlots({ groundId }: GenerateSlotsPayload) {
    
};

export async function handleAdjustSlots({ groundId }: GenerateSlotsPayload) {

};

// Handle failing and mark for manual resolving.
slotWorker.on("failed", async (job, err) => {
    if (!job) return;

    await prisma.schedule.updateMany({
        where: { groundId: job.data.groundId },
        data: { status: ScheduleStatus.FAILED }
    });

    console.error(`[slot-worker] job ${job.id} (${job.name}) failed for ground ${job.data.groundId}:`, err.message);
})
