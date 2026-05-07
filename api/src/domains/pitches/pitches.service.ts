import z from "zod";
import { randomUUID } from "crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import NotificationsService from "@/domains/notifications/notifications.service.js";
import type { CreateGroundPayloadType, CreateInvitationPayloadType, CreatePitchAmenityPayloadType, CreatePitchMediaPresignLinkPayloadType, CreatePitchPayloadType, UpdateGroundPayloadType, UpdateGroundSettingsPayloadType, UpdatePitchAmenityPayloadType, UpdatePitchPayloadType, UpsertGroundSchemaPayloadType } from "@/domains/pitches/pitches.validator.js";
import { GroundSize, GroundSport, GroundStatus, MediaStatus, MediaType, NotificationEvent, PitchStatus, ScheduleStatus, StaffRole } from "@/generated/prisma/enums.js";
import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace.js";

import prisma from "@/shared/lib/utils/prisma.js";
import { BadRequestError, ERROR_CODES, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";
import { bytesToTimeRanges, timeRangesToBytes } from "@/shared/lib/utils/time.js";
import { UNIQUE_AMENITIES } from "@/shared/types/amenity.js";
import { BUCKET, s3 } from "@/shared/lib/utils/s3.js";
import { GroundSlotAction } from "@/shared/types/slots.js";

import { slotsQueue } from "@/jobs/queues/slots.queue.js";

export default class PitchService {
    private readonly MAXIMUM_PITCHES_PER_USER = 5;
    private readonly MAXIMUM_GROUNDS_PER_PITCH = 10;
    private readonly MAXIMUM_AMENITIES_PER_PITCH = 10;

    private readonly EDITABLE_STATES = [PitchStatus.DRAFT, PitchStatus.LIVE, PitchStatus.MAINTENANCE] as PitchStatus[];
    private readonly ACTIVE_STATES = [PitchStatus.ACCEPTED, PitchStatus.LIVE, PitchStatus.MAINTENANCE] as PitchStatus[];

    private readonly notificationsService = new NotificationsService();

    // Helper function to add each of the ground IDs to the ground slot generation queue.
    private readonly enqueueGroundSlotGeneration = async (pitchId: string, grounds: Array<string>) => {
        await Promise.all(
            grounds.map(async (groundId) => {
                await slotsQueue.add(
                    GroundSlotAction.GENERATE, 
                    { pitchId, groundId },
                    {
                        attempts: 3,
                        backoff: { type: "exponential", delay: 5000 },
                        jobId: `generate-${groundId}`,
                    }
                );
            })
        );
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

    createPitch = async (userId: string, payload: CreatePitchPayloadType) => {
        return await prisma.$transaction(async (tx) => {
            // The user should be allowed a maximum of 5 pitches to own and may not create any new pitches as long they already have a draft or is under review.
            const staff = await tx.staff.findMany({
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
    
            if (staff.length >= this.MAXIMUM_PITCHES_PER_USER) throw new BadRequestError(`You may not create more than ${this.MAXIMUM_PITCHES_PER_USER} pitches. If this is an intended action, please get in touch with customer support.`, ERROR_CODES.PITCH_CREATE_LIMIT_EXCEEDED);
    
            const pitches = staff.map(item => item.pitch);
            const statuses = [PitchStatus.DRAFT, PitchStatus.SUBMITTED] as PitchStatus[];
    
            if (pitches.some(pitch => statuses.includes(pitch.status))) throw new BadRequestError("You already have a pending pitch that is either a draft or has been submitted. You can have one pending pitch at a time.", ERROR_CODES.PITCH_DRAFT_EXISTS);
    
            // If the user passes both checks, create them a pitch under draft status.        
            const pitch = await tx.pitch.create({
                data: {
                    ...payload,
                    staff: {
                        create: {
                            userId,
                            role: StaffRole.OWNER
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
    
    updatePitch = async (pitchId: string, payload: UpdatePitchPayloadType) => {
        const pitch = await prisma.pitch.findUnique({
            where: { 
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            select: {
                status: true
            }
        });

        // Check if the pitch exists and has not been soft-deleted.
        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Check if the pitch is even in a state to allow edits.
        if (!this.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // If the pitch passes the checks, update it with the provided payload.
        const updated = await prisma.pitch.update({
            where: {
                id: pitchId
            },
            data: {
                ...payload
            }
        });

        return updated;
    };

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
                        create: {}
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

    generatePitchMediaPresignLink = async (pitchId: string, payload: CreatePitchMediaPresignLinkPayloadType) => {
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

        // Extract the file extension and generate the key.
        const extension = payload.contentType.split("/")[1];
        const key = `uploads/${randomUUID()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: payload.contentType
        });

        const url = await getSignedUrl(
            s3.presign,
            command,
            { expiresIn: 300 }
        );

        // Generate the record in the database to store the media.
        const media = await prisma.pitchMedia.create({
            data: {
                pitchId,
                key,
                url,
                type: MediaType.IMAGE,
                contentType: payload.contentType,
            }
        })

        return { url, id: media.id };
    };

    confirmPitchMediaUpload = async (pitchId: string, mediaId: string) => {
        // Fetch the media and make sure that it is both pending and that the pitch is not deleted.
        const media = await prisma.pitchMedia.findUnique({
            where: { 
                id: mediaId, 
                status: MediaStatus.PENDING,
                pitch: {
                    id: pitchId,
                    status: { not: PitchStatus.DELETED }
                }
            }
        });

        if (!media) throw new NotFoundError("Could not find pending media upload with the specified ID.", ERROR_CODES.PITCH_MEDIA_NOT_FOUND);

        // Create the command sent to s3 to fetch the object data.
        const command = new HeadObjectCommand({ Bucket: BUCKET, Key: media.key });
        
        // If that object can not be found then the upload has failed or can not be verified.
        try {
            await s3.default.send(command);
        } catch {
            throw new BadRequestError("Upload could not be verified. Please try uploading again.", ERROR_CODES.PITCH_MEDIA_CONFIRMATION_FAILED);
        };

        // Update the media to confirm that it is uploaded and active.
        const updated = await prisma.pitchMedia.update({
            where: { id: mediaId },
            data: { status: MediaStatus.UPLOADED }
        });

        return updated;
    };

    submitPitch = async (pitchId: string) => {
        // Find the pitch and ensure that it is a draft before sending it for submission.
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: pitchId,
                status: PitchStatus.DRAFT
            },
            include: {
                amenities: true,
                grounds: {
                    include: {
                        settings: true,
                        schedule: true
                    }
                },
                media: true
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch draft with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Our check needs to pass by four checks to ensure validity for submission.
        // 1. Ensure that the taxId has been submitted.
        const schema = z.string().length(9, "Tax ID must be exactly 9 characters.").regex(/^\d+$/, "Tax ID must contain numbers only.");
        if (!schema.safeParse(pitch.taxId).success) throw new BadRequestError("Tax ID must be provided in the correct format to submit pitch.", ERROR_CODES.VALIDATION_FAILED);

        // 2. Ensure that the pitch has at least one amenity and that they are both in-sync.
        if (pitch.amenities.length !== pitch.amenityList.length)
            throw new InternalServerError("Pitch amenities are out of sync on the denormalized field. Please contact customer support.");

        if (pitch.amenities.length < 1 || pitch.amenityList.length < 1)
            throw new BadRequestError("Pitch needs to have at least one amenity.", ERROR_CODES.PITCH_AMENITY_NOT_FOUND);

        // 3. Ensure that the pitch has at least one ground, that the settings are created successfully, and that each ground has exactly 7 schedule records, one of which has to be active.
        if (pitch.grounds.length < 1) 
            throw new BadRequestError("Pitch needs to have at least one ground.", ERROR_CODES.GROUND_NOT_FOUND);

        if (pitch.grounds.some(ground => !ground.settings))
            throw new InternalServerError("Could not find settings associated with the specified ground.", ERROR_CODES.GROUND_SETTINGS_MISSING);

        if (pitch.grounds.some(ground => ground.schedule.length !== 7))
            throw new BadRequestError("Each ground needs to have a set schedule for each day.", ERROR_CODES.GROUND_SCHEDULE_MISSING);

        if (pitch.grounds.some(ground => ground.schedule.every(schedule => !schedule.isActive)))
            throw new BadRequestError("Ground schedule must have at least one active day per week.", ERROR_CODES.GROUND_SCHEDULE_NOT_ACTIVE);

        // Todo: Uncomment this in testing on the frontend.
        // 4. Ensure that there is at least three verified pitch images.
        // if (pitch.media.filter(m => m.status === MediaStatus.UPLOADED).length < 3)
        //     throw new BadRequestError("There must be at least 3 images uploaded per pitch.", ERROR_CODES.PITCH_MEDIA_BELOW_MINIMUM);

        // After the draft passes all the checks, make sure that both the pitch are submitted and this is logged as an event by the system.
        return await prisma.$transaction(async (tx) => {
            const updated = await tx.pitch.update({
                where: { id: pitchId },
                data: { status: PitchStatus.SUBMITTED }
            });

            await tx.pitchEvent.create({
                data: { 
                    pitchId, 
                    status: PitchStatus.SUBMITTED,
                }
            });

            return updated;
        });
    }

    // Todo: Create a better command line interface to approve the pitch.
    approvePitch = async (pitchId: string) => {        
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: pitchId,
                status: PitchStatus.SUBMITTED
            },
            include: {
                grounds: {
                    include: {
                        schedule: true
                    }
                },
            }
        });

        if (!pitch) {
            console.log("Could not find a submitted pitch with the specified ID.");
            return;
        };

        if (pitch.grounds.some(ground => ground.schedule.some(schedule => schedule.status !== ScheduleStatus.PENDING))) {
            console.log("Ground schedules are no longer pending. Please verify the schedule status before enqueueing.");
            return;
        }

        // Update the pitch status to accepted and add the job to the BullMQ slot generation queue.
        await prisma.$transaction(async (tx) => {
            await tx.pitch.update({
                where: { id: pitchId },
                data: { status: PitchStatus.ACCEPTED }
            });

            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    status: PitchStatus.ACCEPTED,
                }
            });
        });

        console.log("Updated pitch status to ACCEPTED and added event log.");
        
        const grounds = pitch.grounds.map(ground => ground.id);
        console.log("Adding GENERATE jobs to each of the grounds on the pitch.");

        await this.enqueueGroundSlotGeneration(pitchId, grounds);
    };

    createInvitation = async (pitchId: string, creatorId: string, payload: CreateInvitationPayloadType) => {
        // Find pitch and ensure that it is not deleted.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Make sure that it is active to start adding staff to it.
        if (!this.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not send invitation on inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Create the actual invitation record in the database and store the event in the event log.
        const token = randomUUID();

        const invitation = await prisma.$transaction(async tx => {
            const invitation = await tx.invitation.create({
                data: {
                    pitchId,
                    creatorId,
                    token,
                    ...payload
                }
            });

            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    actorId: creatorId,
                    status: pitch.status,
                    reason: `Created an invitation on the pitch for ${payload.phone}.`
                }
            });

            return invitation;
        })

        // Call the notifications service to send out the deliveries.
        // Todo: Extend this later to ensure that it is typed safely and there is a standard message template based on the channel, domain, and event.
        await this.notificationsService.createNotification({ 
            phone: payload.phone, 
            event: NotificationEvent.INVITATION_RECEIVED,
            data: {
                pitchName: pitch.name,
                expiresAt: payload.expiresAt.toISOString(),
                deepLink: `${process.env.FRONTEND_URL}/pitch/${pitchId}/invitations/${token}`
            },
        });

        return invitation;
    }
}
