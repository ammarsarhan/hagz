import prisma from "@/shared/lib/utils/prisma.js";
import type { CreateGroundPayloadType, UpdateGroundPayloadType, UpdateGroundSettingsPayloadType, UpsertGroundSchemaPayloadType } from "../pitches.validator.js";
import { BadRequestError, ERROR_CODES, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";
import { GroundStatus, PitchStatus, ScheduleStatus } from "@/generated/prisma/enums.js";
import { bytesToTimeRanges, timeRangesToBytes } from "@/shared/lib/utils/time.js";
import config from "@/shared/config.js";
import PitchService from "@/domains/pitches/services/pitches.service.js";
import { slotsQueue } from "@/jobs/queues/slots.queue.js";
import { GroundSlotEvent } from "@/shared/types/slots.js";

export default class GroundService {
    createGround = async (pitchId: string, payload: CreateGroundPayloadType) => {
        return await prisma.$transaction(async (tx) => {
            // We need the create ground service function to do six things:

            // 1. Make sure the pitch is in an acceptable status to edit and add new grounds.
            const pitch = await tx.pitch.findUnique({ 
                where: {
                    id: pitchId
                },
                include: {
                    grounds: {
                        select: { 
                            name: true,
                            sport: true, 
                            size: true, 
                            basePrice: true, 
                            discountPrice: true, 
                            peakPrice: true 
                        }                     
                    }
                }
            });

            if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
            if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_ACTIVE)

            // 2. Make sure we haven't hit the grounds per pitch limit.
            const existingGrounds = pitch.grounds;
            if (existingGrounds.length >= config.MAXIMUM_GROUNDS_PER_PITCH) throw new BadRequestError(`You may not create more than ${config.MAXIMUM_GROUNDS_PER_PITCH} ground for a pitch. If this is an intended action, please get in touch with customer support.`, ERROR_CODES.GROUND_CREATE_LIMIT_EXCEEDED);

            // 3. Make sure a ground on the same pitch with the same name does not already exist.
            if (existingGrounds.find(ground => ground.name === payload.name)) throw new BadRequestError("A ground with that name already exists on this ground. Please choose a different name and try again.", ERROR_CODES.GROUND_ALREADY_EXISTS)

            // 4. Create the actual ground model and attach the data we pass down from the handler.
            const ground = await tx.ground.create({
                data: {
                    ...payload,
                    pitchId,
                    // 5. Create the required associated models with Ground (GroundSettings as of now).
                    settings: {
                        create: {}
                    }
                }
            });

            // 6. Attach the data into the denormalized fields on the Pitch model for quick lookups and display purposes.
            const grounds = [...existingGrounds, ground];
            await PitchService.updatePitchDenormalizedFields(tx, pitchId, grounds);

            return ground;
        });
    };
    
    fetchGround = async (pitchId: string, groundId: string) => {
        const ground = await prisma.ground.findUnique({
            where: {
                pitchId,
                id: groundId,
                status: { 
                    not: GroundStatus.DELETED
                }
            }
        });

        if (!ground) throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        
        return ground;
    };

    fetchGrounds = async (pitchId: string) => {
        const grounds = await prisma.ground.findMany({ 
            where: { 
                pitchId,
                status: {
                    not: GroundStatus.DELETED
                }
            },
        });

        return grounds;
    }

    updateGround = async (pitchId: string, groundId: string, payload: UpdateGroundPayloadType) => {
        return await prisma.$transaction(async (tx) => {
            // 1. Verify pitch exists and is in an editable state.
            const pitch = await tx.pitch.findUnique({
                where: { id: pitchId },
                include: {
                    grounds: {
                        where: { status: { not: GroundStatus.DELETED } },
                        select: {
                            id: true,
                            name: true,
                            sport: true,
                            size: true,
                            basePrice: true,
                            discountPrice: true,
                            peakPrice: true,
                        },
                    },
                },
            });

            if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
            if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now.", ERROR_CODES.PITCH_NOT_ACTIVE);

            // 2. Verify the ground actually belongs to this pitch.
            const existing = pitch.grounds.find(g => g.id === groundId);
            if (!existing) throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

            // 3. If renaming, make sure the new name isn't already taken on this pitch.
            if (payload.name && payload.name !== existing.name) {
                const nameConflict = pitch.grounds.some(
                    g => g.id !== groundId && g.name === payload.name
                );
                if (nameConflict) 
                    throw new BadRequestError(
                        "A ground with that name already exists on this pitch. Please choose a different name.",
                        ERROR_CODES.GROUND_ALREADY_EXISTS
                    );
            }

            // 4. Apply the update.
            const ground = await tx.ground.update({
                where: { id: groundId },
                data: payload,
            });

            // 5. Re-derive aggregates using the updated ground merged into the sibling list.
            const updatedGrounds = pitch.grounds.map(g => (g.id === groundId ? { ...g, ...payload } : g));
            await PitchService.updatePitchDenormalizedFields(tx, pitchId, updatedGrounds);

            return ground;
        });
    };

    getGroundSettings = async (pitchId: string, groundId: string) => {
        // Find the settings for the associated not-deleted ground.
        const settings = await prisma.groundSettings.findUnique({
            where: {
                groundId,
                ground: {
                    pitchId,
                    status: { not: GroundStatus.DELETED }
                }
            }
        });
        
        if (!settings) throw new InternalServerError("Could not find settings associated with the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);
        return settings;
    };

    updateGroundSettings = async (pitchId: string, groundId: string, payload: UpdateGroundSettingsPayloadType) => {
        // Check if the ground exists and is in a state allowed to accept updates.
        const settings = await prisma.groundSettings.findUnique({
            where: {
                groundId,
                ground: {
                    pitchId,
                    status: { not: GroundStatus.DELETED }
                },
            },
        });

        if (!settings) throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        // Check for conflicts with values that depend on one another:
        const merged = { ...settings, ...payload };
        
        // allowRecurringBookings & maxRecurringSessions
        if (merged.allowRecurringBookings && !merged.maxRecurringSessions) {
            // Only throw if the user is touching one of these two fields
            if ('allowRecurringBookings' in payload || 'maxRecurringSessions' in payload)
                throw new BadRequestError("Maximum recurring sessions is required when recurring bookings are enabled.", ERROR_CODES.VALIDATION_FAILED);
        }

        // allowDeposit & depositPercentage
        if (merged.allowDeposit && !merged.depositPercentage) {
            if ('allowDeposit' in payload || 'depositPercentage' in payload)
                throw new BadRequestError("Deposit percentage is required when deposits are enabled.", ERROR_CODES.VALIDATION_FAILED);
        }
        
        // minimumWindow must accommodate both expiry timers.
        const expiryLimit = merged.approvalExpiryLimit + merged.paymentExpiryLimit;
        
        if (expiryLimit > merged.maximumWindow * 60) {
            throw new BadRequestError(
                `Minimum booking window (${merged.minimumWindow}h) must be long enough to accommodate the approval window (${merged.approvalExpiryLimit}min) and payment window (${merged.paymentExpiryLimit}min) combined.`,
                ERROR_CODES.VALIDATION_FAILED
            );
        };
            
        // Update the settings with the specified fields from the validated schema.
        const updated = await prisma.groundSettings.update({
            where: { groundId },
            data: { ...payload }
        });

        return updated;
    };

    upsertGroundSchedule = async (pitchId: string, groundId: string, dayOfWeek: number, payload: UpsertGroundSchemaPayloadType) => {
        // Check if the schedule/ground exists and is in a state allowed to accept updates.
        const [pitch, ground, schedule] = await Promise.all([
            prisma.pitch.findUnique({
                where: { id: pitchId, status: { not: PitchStatus.DELETED }, },
                select: { status: true }
            }),
            prisma.ground.findUnique({
                where: { id: groundId, pitchId, status: { not: GroundStatus.DELETED } },
            }),
            prisma.schedule.findUnique({
                where: { groundId_dayOfWeek: { groundId, dayOfWeek } },
                select: { status: true }
            })
        ]);

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!ground) throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);

        const GENERATING_STATUS: ScheduleStatus[] = [ScheduleStatus.PENDING, ScheduleStatus.GENERATING];
        if (schedule && GENERATING_STATUS.includes(schedule.status)) throw new BadRequestError("Schedule is currently loading or generating slots. Please wait until generation is complete before making changes.", ERROR_CODES.GROUND_SLOTS_GENERATING_CONFLICT)

        const updated = await prisma.$transaction(async (tx) => {
            // Convert the time ranges from numerical values to bytes.
            const baseHours = timeRangesToBytes(payload.baseHours);
            const peakHours = timeRangesToBytes(payload.peakHours);
            const discountHours = timeRangesToBytes(payload.discountHours);

            const schedule = await tx.schedule.upsert({
                where: {
                    groundId_dayOfWeek: {
                        groundId,
                        dayOfWeek
                    }
                },
                create: {
                    groundId,
                    dayOfWeek,
                    baseHours,
                    peakHours,
                    discountHours,
                    isActive: payload.isActive
                },
                update: {
                    baseHours,
                    peakHours,
                    discountHours,
                    isActive: payload.isActive,
                    status: ScheduleStatus.PENDING
                }
            });

            return {
                ...schedule,
                baseHours: bytesToTimeRanges(schedule.baseHours),
                peakHours: bytesToTimeRanges(schedule.peakHours),
                discountHours: bytesToTimeRanges(schedule.discountHours),
            };
        });

        // If the pitch is not a draft, we want to enqueue slots adjustment on the upsert.
        if (config.ACTIVE_STATES.includes(pitch.status)) {
            await slotsQueue.add(
                "adjust",
                {
                    event: GroundSlotEvent.ADJUST,
                    groundId,
                    pitchId,
                    dayOfWeek,
                },
                {
                    jobId: `slots-${groundId}-adjust-${dayOfWeek}`,
                }
            )
        }
        
        return updated;
    };

    fetchGroundSchedule = async (pitchId: string, groundId: string, dayOfWeek: number) => {
        // Check if the schedule/ground exists and is in a state allowed to fetch.
        const [ground, schedule] = await Promise.all([
            prisma.ground.findUnique({
                where: { id: groundId, pitchId, status: { not: GroundStatus.DELETED } }
            }),
            prisma.schedule.findUnique({
                where: { groundId_dayOfWeek: { groundId, dayOfWeek } },
            })
        ]);

        if (!ground) throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        if (!schedule) throw new NotFoundError("Schedule does not exist yet. Please define your schedule and try again.", ERROR_CODES.GROUND_SCHEDULE_DOES_NOT_EXIST);

        return {
            ...schedule,
            baseHours: bytesToTimeRanges(schedule.baseHours),
            peakHours: bytesToTimeRanges(schedule.peakHours),
            discountHours: bytesToTimeRanges(schedule.discountHours),
        };
    };

    fetchGroundSchedules = async (pitchId: string, groundId: string) => {
        // Check if the ground exists and is in a state allowed to fetch.
        const [ground, schedules] = await Promise.all([
            prisma.ground.findUnique({
                where: { id: groundId, pitchId, status: { not: GroundStatus.DELETED } }
            }),
            prisma.schedule.findMany({
                where: { 
                    groundId
                    },
            })
        ]);

        if (!ground) throw new NotFoundError("Could not find ground with the specified ID.", ERROR_CODES.GROUND_NOT_FOUND);
        
        // Parse the schedules into parseable form by the client.
        const parsed = schedules.map(schedule => ({
            ...schedule,
            baseHours: bytesToTimeRanges(schedule.baseHours),
            peakHours: bytesToTimeRanges(schedule.peakHours),
            discountHours: bytesToTimeRanges(schedule.discountHours),
        }));

        return parsed;
    };
}