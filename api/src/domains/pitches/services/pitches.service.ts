import z from "zod";

import type { CreatePitchPayloadType, UpdatePitchPayloadType } from "@/domains/pitches/pitches.validator.js";
import { GroundSize, GroundSport, PermissionLevel, PitchStatus, ScheduleStatus, StaffRole, UserStatus } from "@/generated/prisma/enums.js";
import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace.js";

import prisma from "@/shared/lib/utils/prisma.js";
import { BadRequestError, ERROR_CODES, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";
import { GroundSlotEvent } from "@/shared/types/slots.js";

import { slotsQueue } from "@/jobs/queues/slots.queue.js";
import type { Permissions } from "@/shared/types/staff.js";
import config from "@/shared/config.js";

export default class PitchService {
    // Helper function to add each of the ground IDs to the ground slot generation queue.
    private readonly enqueueGroundSlotGeneration = async (pitchId: string, grounds: Array<string>) => {
        await Promise.all(
            grounds.map(async (groundId) => {
                const jobId = `slots:${groundId}:generate`;

                const job = await slotsQueue.getJob(jobId);
                if (job) await job.remove();

                await slotsQueue.add(
                    "generate", 
                    { pitchId, groundId, event: GroundSlotEvent.GENERATE },
                    {
                        attempts: 3,
                        backoff: { type: "exponential", delay: 5000 },
                        jobId,
                    }
                );
            })
        );
    };

    // Helper function to keep the pitch denormalized fields in sync.
    static readonly updatePitchDenormalizedFields = async (
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
    
            if (staff.length >= config.MAXIMUM_PITCHES_PER_USER) throw new BadRequestError(`You may not create more than ${config.MAXIMUM_PITCHES_PER_USER} pitches. If this is an intended action, please get in touch with customer support.`, ERROR_CODES.PITCH_CREATE_LIMIT_EXCEEDED);
    
            const pitches = staff.map(item => item.pitch);
            const statuses = [PitchStatus.DRAFT, PitchStatus.SUBMITTED] as PitchStatus[];
    
            if (pitches.some(pitch => statuses.includes(pitch.status))) throw new BadRequestError("You already have a pending pitch that is either a draft or has been submitted. You can have one pending pitch at a time.", ERROR_CODES.PITCH_DRAFT_EXISTS);
    
            const permissions = {
                settings: PermissionLevel.WRITE,
                schedule: PermissionLevel.WRITE,
                bookings: PermissionLevel.WRITE,
                analytics: PermissionLevel.WRITE,
                payments: PermissionLevel.WRITE,
                layout: PermissionLevel.WRITE,
                team: PermissionLevel.WRITE,
                properties: PermissionLevel.WRITE
            } as Permissions;

            // If the user passes both checks, create them a pitch under draft status.        
            const pitch = await tx.pitch.create({
                data: {
                    ...payload,
                    staff: {
                        create: {
                            userId,
                            permissions,
                            role: StaffRole.OWNER,
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
        if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_ACTIVE);

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
        
        const grounds = pitch.grounds.map(ground => ground.id);
        await this.enqueueGroundSlotGeneration(pitchId, grounds);
    };
};
