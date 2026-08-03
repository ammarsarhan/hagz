import z from "zod";

import { createPitchFeedResponse, normalizeRawPitchFeed, type CreatePitchPayloadType, type FetchPitchFeedPayloadType, type FetchStaffBookingsFiltersPayloadType, type UpdatePitchPayloadType } from "@/domains/pitches/pitches.validator.js";
import { GroundSize, GroundSport, GroundStatus, Language, MediaStatus, MediaType, PermissionLevel, PitchStatus, PitchTier, ScheduleStatus, SlotStatus, StaffRole, UserRole } from "@/generated/prisma/enums.js";
import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace.js";

import prisma from "@/shared/lib/utils/prisma.js";
import { BadRequestError, ERROR_CODES, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";
import { GroundSlotEvent } from "@/shared/types/slots.js";

import { slotsQueue } from "@/jobs/queues/slots.queue.js";
import { pitchesQueue } from "@/jobs/queues/pitches.queue.js";
import { PitchEvent } from "@/shared/types/pitches.js";
import type { Permissions } from "@/shared/types/staff.js";
import config from "@/shared/config.js";
import { addHours, differenceInHours, startOfMonth, subDays } from "date-fns";
import type { Prisma } from "@/generated/prisma/client.js";
import { pitchI18n } from "@/domains/pitches/pitches.i18n.js";
import { createUserResponse } from "@/domains/auth/auth.validator.js";
import verifyGoogleMapsLink from "@/shared/lib/providers/maps.js";
import { bytesToTimeRanges } from "@/shared/lib/utils/time.js";
import { formatInTimeZone } from "date-fns-tz";

export default class PitchService {
    // Helper function to add each of the ground IDs to the ground slot generation queue.
    static readonly enqueueGroundSlotGeneration = async (pitchId: string, grounds: Array<string>) => {
        await Promise.all(
            grounds.map(async (groundId) => {
                const jobId = `slots-${groundId}-generate`;

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

    // Helper function that recieves a booking object and passes the appropriate jobs scheduled for the pitch denormalized activity.
    static readonly enqueueWeeklyBookingExpiration = async (pitchId: string, bookingId: string) => {
        const expirationDelay = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

        await pitchesQueue.add(
            "expire-booking",
            { pitchId, bookingId, event: PitchEvent.EXPIRE_BOOKING },
            { delay: expirationDelay, jobId: `pitches-${pitchId}-weekly-decrement-${bookingId}` }
        );
    };

    // Helper function that cancels the scheduled decrement job for a booking.
    static readonly dequeueWeeklyBookingExpiration = async (pitchId: string, bookingId: string) => {
        const jobId = `pitches-${pitchId}-weekly-decrement-${bookingId}`;
        const job = await pitchesQueue.getJob(jobId);
        if (job) await job.remove();
    };

    // Helper function to update the weeklyBookings count.
    static readonly updateWeeklyBookings = async (tx: TransactionClient, pitchId: string, delta: number) => {
        await tx.pitch.update({
            where: { id: pitchId },
            data: {
                weeklyBookings: {
                    [delta > 0 ? "increment" : "decrement"]: Math.abs(delta)
                }
            }
        });
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
        const prices = grounds.flatMap(g => [g.basePrice, g.peakPrice, g.discountPrice].filter(p => p != null)) as number[];
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
            // Check if the user is signed up as an owner. If they are a user or a manager they shouldn't expect to be able to create a pitch.
            const preferences = await prisma.userPreferences.findUnique({ where: { userId }});
            if (preferences && preferences.role !== UserRole.OWNER) throw new BadRequestError("User account has not been signed up as an owner. Please transfer to an owner account from account settings if this was an intended action.", ERROR_CODES.USER_ROLE_INVALID);

            // The user should be allowed a maximum of 5 pitches to own and may not create any new pitches as long they already have a draft or is under review.
            const staff = await tx.staff.findMany({
                where: { 
                    userId,
                    role: StaffRole.OWNER
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
            const statuses = [PitchStatus.DRAFT, PitchStatus.SUBMITTED, PitchStatus.PROVISIONING] as PitchStatus[];
    
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

            const { longitude, latitude } = await verifyGoogleMapsLink(payload.googleMapsLink);

            // If the user passes both checks and the maps check, create them a pitch under draft status.        
            const pitch = await tx.pitch.create({
                data: {
                    ...payload,
                    longitude,
                    latitude,
                    staff: {
                        create: {
                            userId,
                            permissions,
                            role: StaffRole.OWNER,
                        }
                    }
                },
            });

            const user = await tx.user.findUnique({ where: { id: userId }, include: { pitches: { include: { pitch: { select: { status: true } } } } } });
            if (!user || !preferences) throw new InternalServerError("Failed to fetch updated user profile.");

            const profile = createUserResponse(user, preferences, user.pitches);
            return { pitch, profile };
        });
    };

    // This pertains to the initial data that we want to hydrate our PitchContext with.
    fetchDashboardPitches = async (userId: string) => {
        const pitches = await prisma.pitch.findMany({ 
            where: {
                status: { not: PitchStatus.DELETED },
                staff: {
                    some: {
                        userId
                    }
                }
            },
            select: {
                id: true,
                name: true,
                status: true,
                grounds: {
                    where: {
                        status: {
                            not: GroundStatus.DELETED
                        }
                    },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        sport: true,
                        size: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });
        
        return pitches;
    };

    // Split this into two distinct functions for when we want to send different data based on the person accessing the resource.
    fetchDashboardPitch = async (pitchId: string) => {
        const pitch = await prisma.pitch.findFirst({ 
            where: { 
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                grounds: {
                    where: {
                        status: {
                            not: GroundStatus.DELETED
                        }
                    },
                    include: {
                        schedule: true,
                        settings: true
                    }
                },
                amenities: true,
                media: {
                    where: {
                        status: {
                            not: MediaStatus.DELETED
                        }
                    }
                }
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        
        // Not the cleanest implementation but it's fine.
        if (!pitch.grounds.every(ground => ground.settings)) {
            const error = pitch.grounds.find((ground) => !ground.settings);

            if (error) {
                throw new InternalServerError(
                    `Ground ${error.id} is missing settings.`,
                    ERROR_CODES.GROUND_SETTINGS_MISSING
                );
            };
        };

        const data = {
            ...pitch,
            grounds: pitch.grounds.map((ground) => ({
                ...ground,
                settings: ground.settings!,
                schedule: ground.schedule.map((schedule) => ({
                    ...schedule,
                    baseHours: bytesToTimeRanges(schedule.baseHours),
                    peakHours: bytesToTimeRanges(schedule.peakHours),
                    discountHours: bytesToTimeRanges(schedule.discountHours),
                })),
            })),
        };

        return data;
    };

    fetchUserPitch = async (pitchId: string) => {
        const pitch = await prisma.pitch.findFirst({ 
            where: { 
                id: pitchId,
                status: { not: PitchStatus.DELETED } 
            } 
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        return pitch;
    };
    
    updatePitch = async (userId: string, pitchId: string, payload: UpdatePitchPayloadType) => {
        const pitch = await prisma.pitch.findFirst({
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
        if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_EDITABLE);

        // Check if the Google Maps Link is valid.
        let coordinates = {};

        if (payload.googleMapsLink) {
            const { longitude, latitude } = await verifyGoogleMapsLink(payload.googleMapsLink);
            coordinates = { longitude, latitude };
        }

        // If the pitch passes the checks, update it with the provided payload.
        const updated = await prisma.pitch.update({
            where: {
                id: pitchId
            },
            data: {
                ...payload,
                ...coordinates
            }
        });

        const user = await prisma.user.findUnique({ where: { id: userId }, include: { preferences: true, pitches: { include: { pitch: { select: { status: true } } } } } });
        if (!user || !user.preferences) throw new InternalServerError("Failed to fetch updated user profile.");

        const profile = createUserResponse(user, user.preferences, user.pitches);

        return { updated, profile };
    };

    submitPitch = async (pitchId: string, userId: string) => {
        // Find the pitch and ensure that it is a draft before sending it for submission.
        const pitch = await prisma.pitch.findFirst({
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
                    },
                    where: {
                        status: {
                            not: GroundStatus.DELETED
                        }
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
            throw new InternalServerError("Pitch amenities are out of sync on the denormalized field. Please contact customer support immediately.");

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

        // 4. Ensure that there is at least three verified pitch images.
        if (pitch.media.filter(m => m.status === MediaStatus.UPLOADED).length < 3)
            throw new BadRequestError("There must be at least 3 images uploaded per pitch.", ERROR_CODES.PITCH_MEDIA_BELOW_MINIMUM);

        // After the draft passes all the checks, make sure that both the pitch are submitted and this is logged as an event by the system.
        return await prisma.$transaction(async (tx) => {
            const updated = await tx.pitch.update({
                where: { id: pitchId },
                data: { status: PitchStatus.SUBMITTED }
            });

            await tx.pitchEvent.create({
                data: { 
                    pitchId, 
                    previousStatus: PitchStatus.DRAFT,
                    status: PitchStatus.SUBMITTED,
                }
            });

            const user = await tx.user.findUnique({ where: { id: userId }, include: { preferences: true, pitches: { include: { pitch: { select: { status: true } } } } } });
            if (!user || !user.preferences) throw new InternalServerError("Could not find user account associated with the submitted pitch.");
            const profile = createUserResponse(user, user.preferences, user.pitches);
            
            return { profile, updated };
        });
    };

    deactivatePitch = async (pitchId: string) => {
        // Find the pitch and ensure that it has not been deleted.
        const pitch = await prisma.pitch.findFirst({ where: { id: pitchId, status: { not: PitchStatus.DELETED }}});

        if (!pitch)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Make sure that the status is in a valid state to allow this transition.
        if (pitch.status !== PitchStatus.LIVE)
            throw new BadRequestError(`Could not deactivate pitch because it is currently ${pitch.status.toLowerCase()}.`, ERROR_CODES.PITCH_NOT_LIVE);

        const updated = await prisma.$transaction(async tx => {
            const pitch = await tx.pitch.update({ where: { id: pitchId }, data: { status: PitchStatus.MAINTENANCE }});

            // Create a pitchEvent to keep track of the status changes.
            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    previousStatus: PitchStatus.LIVE,
                    status: PitchStatus.MAINTENANCE,
                }
            });

            return pitch;
        });

        return updated;
    };

    activatePitch = async (pitchId: string) => {
        // Find the pitch and ensure that it has not been deleted.
        const pitch = await prisma.pitch.findFirst({ where: { id: pitchId, status: { not: PitchStatus.DELETED }}});

        if (!pitch)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Make sure that the status is in a valid state to allow this transition.
        if (pitch.status !== PitchStatus.MAINTENANCE)
            throw new BadRequestError(`Could not activate pitch because it is currently ${pitch.status.toLowerCase()}.`, ERROR_CODES.PITCH_NOT_ACTIVE);

        const updated = await prisma.$transaction(async tx => {
            const pitch = await tx.pitch.update({ where: { id: pitchId }, data: { status: PitchStatus.LIVE }});

            // Create a pitchEvent to keep track of the status changes.
            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    previousStatus: PitchStatus.MAINTENANCE,
                    status: PitchStatus.LIVE,
                    reason: "Reactivated from maintenance"
                }
            });

            return pitch;
        });

        return updated;
    };

    static rejectPitch = async (pitchId: string, reason: string, actorId?: string) => {
        if (!reason || !reason.trim()) {
            throw new BadRequestError("A rejection reason must be provided.", ERROR_CODES.VALIDATION_FAILED);
        }

        const pitch = await prisma.pitch.findFirst({
            where: { id: pitchId, status: PitchStatus.SUBMITTED }
        });

        if (!pitch) {
            throw new BadRequestError("Could not find a submitted pitch to reject with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        }

        const updated = await prisma.$transaction(async (tx) => {
            const pitch = await tx.pitch.update({
                where: { id: pitchId },
                data: { status: PitchStatus.DRAFT }
            });

            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    previousStatus: PitchStatus.SUBMITTED,
                    status: PitchStatus.DRAFT,
                    actorId: actorId ?? null,
                    reason: reason.trim()
                }
            });

            return pitch;
        });

        return updated;
    };

    static approvePitch = async (pitchId: string, actorId?: string) => {        
        const pitch = await prisma.pitch.findFirst({
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
        }

        if (pitch.grounds.some(ground => ground.schedule.some(schedule => schedule.status !== ScheduleStatus.PENDING))) {
            console.log("Ground schedules are no longer pending. Please verify the schedule status before enqueueing.");
            return;
        }

        // Update the pitch status to PROVISIONING and add the job to the BullMQ slot generation queue.
        await prisma.$transaction(async (tx) => {
            await tx.pitch.update({
                where: { id: pitchId },
                data: { status: PitchStatus.PROVISIONING }
            });

            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    previousStatus: PitchStatus.SUBMITTED,
                    status: PitchStatus.PROVISIONING,
                    actorId: actorId ?? null,
                    reason: "Pitch approved by staff. Enqueued background setup."
                }
            });
        });
        
        const grounds = pitch.grounds.map(ground => ground.id);
        await PitchService.enqueueGroundSlotGeneration(pitchId, grounds);
    };

    fetchAvailability = async (pitchId: string, target?: string) => {
        // Make sure that the pitch is not deleted and active first before attempting to build the availability.
        const pitch = await prisma.pitch.findFirst({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED },
            },
            include: {
                grounds: {
                    where: {
                        status: { not: GroundStatus.DELETED }
                    },
                    include: {
                        settings: true
                    }
                }
            }
        });

        if (!pitch)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Could not query availability for the specified pitch. Pitch needs to be active first.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // If a target ground is specified, verify it exists on this pitch.
        if (target) {
            const groundExists = pitch.grounds.some(ground => ground.id === target);
            if (!groundExists)
                throw new NotFoundError("Could not find the specified ground on this pitch.", ERROR_CODES.GROUND_NOT_FOUND);
        }

        // Determine which grounds to query availability for.
        const grounds = target
            ? pitch.grounds.filter(ground => ground.id === target)
            : pitch.grounds;

        // Start building the query's startDate, endDate, and grounds.
        const today = new Date();

        const maximumWindow = Math.max(
            ...grounds.map(ground => {
                if (!ground.settings) throw new InternalServerError("Could not find settings associated with ground.");
                return ground.settings.maximumWindow;
            })
        );

        const lowerBoundary = startOfMonth(subDays(today, 30));
        const upperBoundary = addHours(today, maximumWindow);

        // Fetch every generated slot in the window and read status straight off GroundSlot, instead of re-deriving booked from Booking rows + date bucketing.
        const bookedSlots = await prisma.groundSlot.findMany({
            where: {
                pitchId,
                groundId: { in: grounds.map(g => g.id) },
                startsAt: { gte: lowerBoundary, lte: upperBoundary },
                status: SlotStatus.BOOKED,
            },
            select: {
                startsAt: true,
            },
        });

        const bookedDates = new Set(
            bookedSlots.map(slot =>
                formatInTimeZone(slot.startsAt, "Africa/Cairo", "yyyy-MM-dd")
            )
        );

        // Generate one entry per calendar day across the full window.
        const availability: { date: Date; isBooked: boolean }[] = [];

        const cursor = new Date(lowerBoundary);
        cursor.setUTCHours(0, 0, 0, 0);

        const end = new Date(upperBoundary);
        end.setUTCHours(0, 0, 0, 0);

        while (cursor <= end) {
            const key = cursor.toISOString().slice(0, 10);

            availability.push({ date: new Date(cursor), isBooked: bookedDates.has(key) });
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        // 30 day constraint as per the slot purging job scheduled.
        return { constraints: { minimumWindow: differenceInHours(today, lowerBoundary), maximumWindow }, availability };
    };
    
    fetchFeed = async (payload: FetchPitchFeedPayloadType, userId?: string, locale: Language = Language.EN) => {
        const include = {
            area: {
                include: {
                    translations: {
                        where: { locale },
                        select: { name: true },
                        take: 1,
                    },
                    governorate: {
                        select: { name: true }
                    }
                },
            },
            translations: {
                where: { locale },
                select: { name: true, description: true },
                take: 1,
            },
            media: {
                where: { status: MediaStatus.UPLOADED, type: MediaType.IMAGE },
                orderBy: { order: "asc" as const },
                take: 1,
                select: { url: true },
            },
        } satisfies Prisma.PitchInclude;

        const [[general, personalized], favorites] = await Promise.all([
            Promise.all([
                Promise.all([
                    prisma.pitch.findMany({
                        where: { status: PitchStatus.LIVE, isFeatured: true },
                        include,
                        take: 10,
                    }),
                    prisma.pitch.findMany({
                        where: { status: PitchStatus.LIVE },
                        orderBy: { weeklyBookings: "desc" },
                        include,
                        take: 10,
                    }),
                    prisma.pitch.findMany({
                        where: { status: PitchStatus.LIVE, reviewCount: { gte: 5 } },
                        orderBy: { averageRating: "desc" },
                        include,
                        take: 3,
                    }),
                    prisma.pitch.findMany({
                        where: {
                            status: PitchStatus.LIVE,
                            minimumPrice: { gte: 150 },
                            maximumPrice: { lte: 250 },
                        },
                        include,
                        take: 10,
                    }),
                    prisma.pitch.findMany({
                        where: {
                            status: PitchStatus.LIVE ,
                            grounds: { some: { settings: { autoConfirm: true } } },
                        },
                        include,
                        take: 10,
                    }),
                    prisma.pitch.findMany({
                        where: { status: PitchStatus.LIVE, tier: PitchTier.PREMIUM },
                        include,
                        take: 5,
                    }),
                ]),
                Promise.all([
                    userId
                        ? prisma.pitch.findMany({
                            where: {
                                status: PitchStatus.LIVE ,
                                bookings: { some: { initiatorId: userId } },
                            },
                            include,
                            take: 5,
                        })
                        : Promise.resolve([]),
                    payload.latitude !== undefined && payload.longitude !== undefined
                        ? prisma.$queryRaw<Array<Record<string, any>>>`
                            SELECT
                                p.id,
                                COALESCE(pt.name, p.name)  AS name,
                                p.tier,
                                p.sports,
                                p.amenity_list,
                                p.minimum_price,
                                p.maximum_price,
                                p.average_rating,
                                p.review_count,
                                a.id                       AS area_id,
                                COALESCE(at.name, a.name)  AS area_name,
                                g.name                     AS governorate_name,
                                m.url                      AS media_url,
                                ST_Distance(
                                    p.location,
                                    ST_SetSRID(ST_MakePoint(${payload.longitude}, ${payload.latitude}), 4326)::geography
                                ) AS distance
                            FROM "Pitch" p
                            JOIN "Area" a ON a.id = p.area_id
                            JOIN "Governorate" g ON g.id = a.governorate_id
                            LEFT JOIN LATERAL (
                                SELECT name FROM "PitchTranslation"
                                WHERE pitch_id = p.id AND locale = ${locale}
                                LIMIT 1
                            ) pt ON true
                            LEFT JOIN LATERAL (
                                SELECT name FROM "AreaTranslation"
                                WHERE area_id = a.id AND locale = ${locale}
                                LIMIT 1
                            ) at ON true
                            LEFT JOIN LATERAL (
                                SELECT url FROM "PitchMedia"
                                WHERE pitch_id = p.id
                                AND status = 'UPLOADED'
                                AND type = 'IMAGE'
                                ORDER BY "order" ASC
                                LIMIT 1
                            ) m ON true
                            WHERE p.status = 'LIVE'
                            AND p.location IS NOT NULL
                            AND ST_DWithin(
                                p.location,
                                ST_SetSRID(ST_MakePoint(${payload.longitude}, ${payload.latitude}), 4326)::geography,
                                25000
                            )
                            ORDER BY p.location <-> ST_SetSRID(
                                ST_MakePoint(${payload.longitude}, ${payload.latitude}),
                                4326
                            )::geography
                            LIMIT 10
                        `
                        : Promise.resolve([]),
                ]),
            ]),
            userId
                ? prisma.favorite
                    .findMany({ where: { userId }, select: { pitchId: true } })
                    .then((rows) => new Set(rows.map((r) => r.pitchId)))
                : Promise.resolve(new Set<string>()),
        ]);

        const [featured, hot, topRated, budget, instant, premium] = general;
        const [recents, nearby] = personalized;

        const normalize = (raw: any) => normalizeRawPitchFeed(raw, favorites);

        const t = pitchI18n[locale];

        return {
            general: {
                featured: {
                    title: t.feed.general.featured.title,
                    description: t.feed.general.featured.description,
                    cards: createPitchFeedResponse(featured.map(normalize), t.feed.general.featured.badge),
                },
                hot: {
                    title: t.feed.general.hot.title,
                    description: t.feed.general.hot.description,
                    cards: createPitchFeedResponse(hot.map(normalize)),
                },
                topRated: {
                    title: t.feed.general.topRated.title,
                    description: t.feed.general.topRated.description,
                    cards: createPitchFeedResponse(topRated.map(normalize)),
                },
                budget: {
                    title: t.feed.general.budget.title,
                    description: t.feed.general.budget.description,
                    cards: createPitchFeedResponse(budget.map(normalize)),
                },
                instant: {
                    title: t.feed.general.instant.title,
                    description: t.feed.general.instant.description,
                    cards: createPitchFeedResponse(instant.map(normalize)),
                },
                premium: {
                    title: t.feed.general.premium.title,
                    description: t.feed.general.premium.description,
                    cards: createPitchFeedResponse(premium.map(normalize), t.feed.general.premium.badge),
                },
            },
            personalized: {
                recents: {
                    title: t.feed.personalized.recents.title,
                    description: t.feed.personalized.recents.description,
                    cards: createPitchFeedResponse(recents.map(normalize)),
                },
                nearby: {
                    title: t.feed.personalized.nearby.title,
                    description: payload.latitude ? t.feed.personalized.nearby.description : null,
                    cards: createPitchFeedResponse(nearby.map(normalize)),
                },
            }
        };
    };
    
    toggleFavorite = async (userId: string, pitchId: string, isFavorite: boolean) => {
        // 1. Verify pitch exists and is not deleted
        const pitch = await prisma.pitch.findUnique({
            where: { id: pitchId, status: { not: PitchStatus.DELETED } },
            select: { id: true }
        });

        if (!pitch) {
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        }

        if (isFavorite) {
            // Add to favorites
            return await prisma.favorite.upsert({
                where: {
                    userId_pitchId: { userId, pitchId }
                },
                create: { userId, pitchId },
                update: {} // Do nothing if already exists
            });
        } else {
            // Remove from favorites
            try {
                return await prisma.favorite.delete({
                    where: {
                        userId_pitchId: { userId, pitchId }
                    }
                });
            } catch (error) {
                // If it doesn't exist, we can just return success as the end state is what's desired
                return { userId, pitchId };
            }
        }
    };

    fetchUserFavorites = async (userId: string) => {
        return await prisma.favorite.findMany({
            where: { userId },
            include: {
                pitch: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        averageRating: true,
                        reviewCount: true,
                        media: {
                            where: { order: 1 },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });
    };

    fetchStaffBookings = async (pitchId: string, filters: FetchStaffBookingsFiltersPayloadType) => {
        const pitch = await prisma.pitch.findFirst({
            where: {
                id: pitchId,
                status: {
                    not: PitchStatus.DELETED,
                },
            },
            select: {
                status: true,
            },
        });

        if (!pitch)
            throw new NotFoundError(
                "Could not find pitch with the specified ID.",
                ERROR_CODES.PITCH_NOT_FOUND
            );

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError(
                "Could not fetch bookings on an inactive pitch. Make sure your pitch is active first.",
                ERROR_CODES.PITCH_NOT_ACTIVE
            );

        const { status, startDate, endDate, page, limit } = filters;

        const where = {
            pitchId,
            startsAt: {
                gte: startDate,
                lte: endDate,
            },
            ...(!status && {
                status: SlotStatus.BOOKED,
            }),
            booking: {
                ...(status && { status }),
            },
        };

        const query = await prisma.groundSlot.findMany({
            where,
            include: {
                ground: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                booking: {
                    select: {
                        id: true,
                        status: true,
                        pricingSnapshot: true,
                        customer: {
                            select: {
                                firstName: true,
                                lastName: true,
                                phone: true,
                            }
                        },
                        initiator: {
                            select: {
                                firstName: true,
                                lastName: true,
                                avatarUrl: true
                            }
                        }
                    },
                },
            },
            orderBy: [
                {
                    startsAt: "asc",
                },
                {
                    ground: {
                        name: "asc",
                    },
                },
            ],
        });

        const slots = query.reduce<{hour: Date; bookings: typeof query}[]>((acc, slot) => {
            let group = acc.find(g => g.hour.getTime() === slot.startsAt.getTime());

            if (!group) {
                group = {
                    hour: slot.startsAt,
                    bookings: [],
                };
                acc.push(group);
            };

            group.bookings.push(slot);
            return acc;
        }, []);

        return {
            slots,
            pagination: {
                total: slots.length,
                page,
                limit,
                pages: Math.ceil(slots.length / limit),
            },
        };
    };

    fetchPitchCustomer = async (pitchId: string, phone: string) => {
        // We don't want to validate the pitch or ground availability here. Keep this ridiculously lightweight.
        const customer = await prisma.pitchCustomer.findUnique({
            where: {
                pitchId_phone: {
                    pitchId,
                    phone,
                },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                userId: true,
            },
        });

        return {
            exists: !!customer,
            customer,
        };
    };
};
