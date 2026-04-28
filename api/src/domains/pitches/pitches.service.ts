import type { CreateGroundPayloadType, CreatePitchAmenityPayloadType, CreatePitchPayloadType, UpdateGroundPayloadType, UpdateGroundSettingsPayloadType, UpdatePitchAmenityPayloadType, UpsertGroundSchemaPayloadType } from "@/domains/pitches/pitches.validator.js";
import { BadRequestError, ERROR_CODES, InternalServerError, NotFoundError } from "@/shared/lib/error.js";
import prisma from "@/shared/lib/prisma.js";
import { bytesToTimeRanges, timeRangesToBytes } from "@/shared/lib/time.js";

import { GroundSize, GroundSport, GroundStatus, PermissionsRole, PitchStatus, ScheduleStatus } from "@/generated/prisma/enums.js";
import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace.js";
import { slotQueue } from "@/jobs/queues/slots.queue.js";
import { GroundSlotAction } from "@/jobs/workers/slots.worker.js";
import { UNIQUE_AMENITIES } from "@/shared/types/amenity.js";

export default class PitchService {
    private readonly MAXIMUM_PITCHES_PER_USER = 5;
    private readonly MAXIMUM_GROUNDS_PER_PITCH = 10;
    private readonly MAXIMUM_AMENITIES_PER_PITCH = 10;

    private readonly EDITABLE_STATES = [PitchStatus.DRAFT, PitchStatus.LIVE, PitchStatus.MAINTENANCE] as PitchStatus[];

    createPitch = async (userId: string, payload: CreatePitchPayloadType) => {
        return await prisma.$transaction(async (tx) => {
            // The user should be allowed a maximum of 5 pitches to own and may not create any new pitches as long they already have a draft or is under review.
            const permissions = await tx.pitchPermissions.findMany({
                where: { 
                    userId,
                    role: "OWNER"
                },
                include: {
                    pitch: {
                        select: {
                            status: true
                        }
                    }
                }
            });
    
            if (permissions.length >= this.MAXIMUM_PITCHES_PER_USER) throw new BadRequestError(`You may not create more than ${this.MAXIMUM_PITCHES_PER_USER} pitches. If this is an intended action, please get in touch with customer support.`, ERROR_CODES.PITCH_CREATE_LIMIT_EXCEEDED);
    
            const pitches = permissions.map(item => item.pitch);
            const statuses = [PitchStatus.DRAFT, PitchStatus.SUBMITTED] as PitchStatus[];
    
            if (pitches.some(pitch => statuses.includes(pitch.status))) throw new BadRequestError("You already have a pending pitch that is either a draft or has been submitted. You can have one pending pitch at a time.", ERROR_CODES.PITCH_DRAFT_EXISTS);
    
            // If the user passes both checks, create them a pitch under draft status.        
            const pitch = await tx.pitch.create({
                data: {
                    ...payload,
                    permissions: {
                        create: {
                            userId,
                            role: PermissionsRole.OWNER
                        }
                    }
                },
            });
    
            return pitch;
        });
    };

    fetchPitch = async (pitchId: string) => {
        const pitch = await prisma.pitch.findUnique({ 
            where: { 
                id: pitchId,
                status: { not: PitchStatus.DELETED } 
            } 
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        return pitch;
    };

    // Helper function to keep the pitch denormalized fields in sync.
    private readonly updatePitchDenormalizedFields = async (
        tx: TransactionClient, 
        pitchId: string, 
        grounds: Array<{
            sport: GroundSport;
            size: GroundSize;
            basePrice: number;
            peakPrice: number | null;
            discountPrice: number | null;
        }>
    ) => {
        const sports = [...new Set(grounds.map(g => g.sport))];
        const sizes = [...new Set(grounds.map(g => g.size))];

        // Filter out the non-number values and create an array with all the prices then compare.
        const prices = grounds.flatMap(g => [g.basePrice, g.peakPrice, g.discountPrice].filter(Boolean)) as number[];
        const minimumPrice = Math.min(...prices);
        const maximumPrice = Math.max(...prices);

        await tx.pitch.update({
            where: { 
                id: pitchId
            },
            data: {
                sports,
                sizes,
                minimumPrice,
                maximumPrice
            }
        });
    }

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
            if (!this.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_ACTIVE)

            // 2. Make sure we haven't hit the grounds per pitch limit.
            const existingGrounds = pitch.grounds;
            if (existingGrounds.length >= this.MAXIMUM_GROUNDS_PER_PITCH) throw new BadRequestError(`You may not create more than ${this.MAXIMUM_GROUNDS_PER_PITCH} ground for a pitch. If this is an intended action, please get in touch with customer support.`, ERROR_CODES.GROUND_CREATE_LIMIT_EXCEEDED);

            // 3. Make sure a ground on the same pitch with the same name does not already exist.
            if (existingGrounds.find(ground => ground.name === payload.name)) throw new BadRequestError("A ground with that name already exists on this ground. Please choose a different name and try again.", ERROR_CODES.GROUND_ALREADY_EXISTS)

            // 4. Create the actual ground model and attach the data we pass down from the handler.
            const ground = await tx.ground.create({
                data: {
                    ...payload,
                    pitchId,
                    // 5. Create the required associated models with Ground (GroundSettings as of now).
                    settings: {
                        create: {
                            
                        }
                    }
                }
            });

            // 6. Attach the data into the denormalized fields on the Pitch model for quick lookups and display purposes.
            const grounds = [...existingGrounds, ground];
            await this.updatePitchDenormalizedFields(tx, pitchId, grounds);

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
            if (!this.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now.", ERROR_CODES.PITCH_NOT_ACTIVE);

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
            await this.updatePitchDenormalizedFields(tx, pitchId, updatedGrounds);

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
        if (schedule && schedule.status === ScheduleStatus.GENERATING) throw new BadRequestError("Schedule is currently generating slots. Please wait until generation is complete before making changes.", ERROR_CODES.GROUND_SLOTS_GENERATING_CONFLICT)

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
                    isActive: payload.isActive
                }
            });

            // Todo: Implement the logic to add a job based on the pitch's current state.

            return {
                ...schedule,
                baseHours: bytesToTimeRanges(schedule.baseHours),
                peakHours: bytesToTimeRanges(schedule.peakHours),
                discountHours: bytesToTimeRanges(schedule.discountHours),
            };
        })
        
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

    createPitchAmenity = async (pitchId: string, payload: CreatePitchAmenityPayloadType) => {
        // Find the pitch and make sure it is in an editable state.
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                amenities: true
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!this.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Make sure the pitch does not have more than 10 amenity records.
        if (pitch.amenities.length > this.MAXIMUM_AMENITIES_PER_PITCH) throw new BadRequestError(`Pitch may not have more than ${this.MAXIMUM_AMENITIES_PER_PITCH} amenities. Please delete one or try updating it first.`, ERROR_CODES.PITCH_AMENITY_LIMIT_EXCEEDED);

        // Make sure the pitch does not already have a unique amenity of the specified payload type.
        if (UNIQUE_AMENITIES.has(payload.name)) {
            const exists = pitch.amenities.some(a => a.name === payload.name);
            if (exists) throw new BadRequestError(`Pitch already has a ${payload.name} amenity. This amenity can only be added once.`, ERROR_CODES.PITCH_AMENITY_DUPLICATE);
        };

        // Create the actual amenity object and update the pitch to keep the denormalized field in sync.
        const amenity = await prisma.$transaction(async (tx) => {
            const order = pitch.amenities.length + 1;

            const amenity = await tx.amenity.create({
                data: { 
                    ...payload,
                    pitchId,
                    order
                }
            });

            const amenityList = [...pitch.amenityList, payload.name];

            await tx.pitch.update({
                where: { id: pitchId },
                data: { amenityList }
            });

            return amenity;
        });

        return amenity;
    };

    fetchPitchAmenity = async (pitchId: string, order: number) => {
        // Find the pitch and make sure it is in an queryable state.
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            }
        });
    
        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Fetch the amenity associated with the pitch and the requested order.
        const amenity = await prisma.amenity.findUnique({
            where: {
                pitchId_order: {
                    pitchId,
                    order
                }
            }
        });

        if (!amenity) throw new NotFoundError("Could not find amenity with the specified ID.", ERROR_CODES.PITCH_AMENITY_NOT_FOUND);
        return amenity;
    };

    fetchPitchAmenities = async (pitchId: string) => {
        // Find the pitch and make sure it is in an queryable state.
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Fetch the amenities associated with the pitch.
        const amenities = await prisma.amenity.findMany({
            where: { pitchId }
        });

        return amenities;
    };

    updatePitchAmenity = async (pitchId: string, order: number, payload: UpdatePitchAmenityPayloadType) => {
        // Find the pitch and make sure it is in an editable state.
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                amenities: true
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!this.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Check if the amenity even exists on the specified pitch.
        const target = pitch.amenities.find(a => a.order === order);
        if (!target) throw new NotFoundError("Could not find amenity with the specified order.", ERROR_CODES.PITCH_AMENITY_NOT_FOUND);

        // If the name is being changed, check for duplicates on unique amenities.
        if (payload.name && UNIQUE_AMENITIES.has(payload.name)) {
            const exists = pitch.amenities.some(a => a.name === payload.name && a.order !== order);
            if (exists) throw new BadRequestError(
                `Pitch already has a ${payload.name} amenity. This amenity can only be added once.`,
                ERROR_CODES.PITCH_AMENITY_DUPLICATE
            );
        };

        // Update the amenity for the requested pitch on the index provided.
        return await prisma.$transaction(async (tx) => {
            const amenity = await tx.amenity.update({
                where: { pitchId_order: { pitchId, order } },
                data: { ...payload }
            });

            // Update the denormalized amenity list on the pitch to keep it in sync.
            if (payload.name) {
                const amenityList = pitch.amenities.map(a => 
                    a.order === order ? payload.name! : a.name
                );

                await tx.pitch.update({
                    where: { id: pitchId },
                    data: { amenityList }
                });
            }

            return amenity;
        });
    };

    deletePitchAmenity = async (pitchId: string, order: number) => {
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                amenities: true
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!this.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_ACTIVE);

        const target = pitch.amenities.find(a => a.order === order);
        if (!target) throw new NotFoundError("Could not find amenity with the specified order.", ERROR_CODES.PITCH_AMENITY_NOT_FOUND);

        return await prisma.$transaction(async (tx) => {
            // Delete the amenity.
            await tx.amenity.delete({
                where: { pitchId_order: { pitchId, order } }
            });

            // Reorder the remaining amenities so there are no gaps.
            const remaining = pitch.amenities
                .filter(a => a.order !== order)
                .sort((a, b) => a.order - b.order);

            await Promise.all(
                remaining.map((a, i) =>
                    tx.amenity.update({
                        where: { pitchId_order: { pitchId, order: a.order } },
                        data: { order: i + 1 }
                    })
                )
            );

            // Sync the denormalized amenity list.
            await tx.pitch.update({
                where: { id: pitchId },
                data: { amenityList: remaining.map(a => a.name) }
            });
        });
    };
}
