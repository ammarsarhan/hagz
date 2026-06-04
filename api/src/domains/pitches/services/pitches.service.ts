import z from "zod";

import type { CreatePitchPayloadType, QueryPitchesPayloadType, UpdatePitchPayloadType } from "@/domains/pitches/pitches.validator.js";
import { GroundSize, GroundSport, GroundStatus, PermissionLevel, PitchStatus, ScheduleStatus, StaffRole } from "@/generated/prisma/enums.js";
import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace.js";

import prisma from "@/shared/lib/utils/prisma.js";
import { BadRequestError, ERROR_CODES, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";
import { formatPitchAvailabilityQuery, GroundSlotEvent } from "@/shared/types/slots.js";

import { slotsQueue } from "@/jobs/queues/slots.queue.js";
import type { Permissions } from "@/shared/types/staff.js";
import config from "@/shared/config.js";
import { addHours, endOfWeek, isBefore, startOfWeek } from "date-fns";
import getGridSize from "@/shared/lib/utils/map.js";

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

    private applyAvailabilityFilter = async <T extends {
        id: string;
        grounds: Array<{
            id: string;
            basePrice: number;
            peakPrice: number | null;
            discountPrice: number | null;
            settings: { 
                minimumWindow: number; 
                maximumWindow: number; 
                minimumDuration: number; 
                maximumDuration: number; 
                autoConfirm: boolean 
            } | null;
        }>
    }>(
        pitches: T[], 
        availability: NonNullable<QueryPitchesPayloadType["availability"]>,
        priceFilter?: { minimum?: number; maximum?: number }
    ): Promise<T[]> => {
        const now = new Date();

        // Helper to determine if a set of slots is available and fits the price filter.
        const checkAvailability = (
            ground: T["grounds"][0],
            requiredTimes: Date[],
            availableSlots: Map<number, { priceType: string }>
        ): boolean => {
            if (requiredTimes.length === 0) return false;

            for (const time of requiredTimes) {
                const slot = availableSlots.get(time.getTime());
                if (!slot) return false;

                let price = ground.basePrice;
                if (slot.priceType === "PEAK" && ground.peakPrice != null) price = ground.peakPrice;
                if (slot.priceType === "DISCOUNT" && ground.discountPrice != null) price = ground.discountPrice;

                console.log("slot", time.toISOString(), "priceType", slot.priceType, "price", price);

                if (priceFilter?.minimum != null && price < priceFilter.minimum) return false;
                if (priceFilter?.maximum != null && price > priceFilter.maximum) return false;
            }

            return true;
        };

        const getCandidateRanges = (groundMinimumWindow: number): Date[][] => {
            const flooredNow = new Date(now);
            flooredNow.setUTCMinutes(0, 0, 0);

            // If now is not exactly on the hour, ceil to the next hour.
            const ceiledNow = now.getUTCMinutes() === 0 && now.getUTCSeconds() === 0 
                ? flooredNow 
                : addHours(flooredNow, 1);

            const earliest = addHours(ceiledNow, groundMinimumWindow);
            const ranges: Date[][] = [];

            switch (availability.mode) {
                case "specific": {
                    const start = new Date(availability.date);
                    start.setHours(availability.startHour, 0, 0, 0);
                    if (isBefore(start, earliest)) return [];
                    ranges.push(Array.from({ length: availability.durationHours }, (_, i) => addHours(start, i)));
                    break;
                }
                case "time": {
                    for (let d = 0; d < 14; d++) {
                        const start = addHours(now, d * 24);
                        start.setHours(availability.startHour, 0, 0, 0);
                        if (isBefore(start, earliest)) continue;
                        ranges.push(Array.from({ length: availability.durationHours }, (_, i) => addHours(start, i)));
                    }
                    break;
                }
                case "recurring": {
                    for (let d = 0; d < 14; d++) {
                        const start = addHours(now, d * 24);
                        start.setHours(availability.startHour, 0, 0, 0);
                        if (start.getDay() !== (availability.dayOfWeek % 7)) continue;
                        if (isBefore(start, earliest)) continue;
                        
                        const sessionBlocks: Date[] = [];
                        for (let s = 0; s < availability.sessions; s++) {
                            const sessionStart = addHours(start, s * 7 * 24);
                            for (let i = 0; i < availability.durationHours; i++) {
                                sessionBlocks.push(addHours(sessionStart, i));
                            }
                        }
                        ranges.push(sessionBlocks);
                        break; // Scan only the next occurrence.
                    }
                    break;
                }
                case "window": {
                    const windowDate = new Date(availability.date);
                    for (let h = availability.fromHour; h + availability.durationHours <= availability.toHour; h++) {
                        const start = new Date(windowDate);
                        start.setHours(h, 0, 0, 0);
                        if (isBefore(start, earliest)) continue;
                        ranges.push(Array.from({ length: availability.durationHours }, (_, i) => addHours(start, i)));
                    }
                    break;
                }
                case "available": {
                    const range: Date[] = [];
                    for (let h = 0; h < 3 * 24; h++) {
                        const t = addHours(earliest, h);
                        range.push(t);
                    }
                    ranges.push(range);
                    break;
                }
            }
            return ranges;
        };

        const groundIds = pitches.flatMap(p => p.grounds.map(g => g.id));
        const rangesByGround = new Map<string, Date[][]>();
        for (const pitch of pitches) {
            for (const ground of pitch.grounds) {
                const ranges = getCandidateRanges(ground.settings?.minimumWindow ?? 2);
                if (ranges.length) rangesByGround.set(ground.id, ranges);
            }
        }

        const allTimes = [...new Set([...rangesByGround.values()].flat(2).map(d => d.getTime()))].map(t => new Date(t));
        if (!allTimes.length) return [];

        const availableSlots = await prisma.groundSlot.findMany({
            where: {
                groundId: { in: groundIds },
                status: "AVAILABLE",
                startsAt: { in: allTimes },
            },
            select: { groundId: true, startsAt: true, priceType: true },
        });

        const slotsByGround = new Map<string, Map<number, { priceType: string }>>();
        for (const slot of availableSlots) {
            if (!slotsByGround.has(slot.groundId)) slotsByGround.set(slot.groundId, new Map());
            slotsByGround.get(slot.groundId)!.set(slot.startsAt.getTime(), { priceType: slot.priceType });
        }

        const passingPitches: T[] = [];
        for (const pitch of pitches) {
            let pitchAvailable = false;
            for (const ground of pitch.grounds) {
                // Enforce minimum and maximum duration constraints from ground settings once per ground.
                if (ground.settings) {
                    if (availability.durationHours < ground.settings.minimumDuration) continue;
                    if (availability.durationHours > ground.settings.maximumDuration) continue;
                }

                const ranges = rangesByGround.get(ground.id) || [];
                const available = slotsByGround.get(ground.id);
                if (!available) continue;

                if (availability.mode === "available") {
                    const times = ranges[0].sort((a, b) => a.getTime() - b.getTime());
                    const duration = availability.durationHours;
                    let contiguous = 0;

                    for (let i = 0; i < times.length; i++) {
                        // Check only slot existence here, not price.
                        const slot = available.get(times[i].getTime());
                        if (slot) {
                            contiguous++;
                            if (contiguous >= duration) {
                                // We have enough contiguous available slots — now check the
                                // block's average price as a whole, the same way other modes do.
                                const block = times.slice(i - duration + 1, i + 1);
                                if (checkAvailability(ground, block, available)) {
                                    pitchAvailable = true;
                                    break;
                                }
                                // Price failed for this block. Slide the window forward by
                                // dropping the oldest slot rather than resetting entirely —
                                // the next candidate block starts one slot later.
                                contiguous--;
                            }
                        } else {
                            contiguous = 0;
                        }
                    }

                    if (pitchAvailable) break;
                } else {
                    if (ranges.some(r => checkAvailability(ground, r, available))) {
                        pitchAvailable = true;
                        break;
                    }
                }
            }
            if (pitchAvailable) passingPitches.push(pitch);
        }

        return passingPitches;
    };

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

    // Split this into two distinct functions for when we want to send different data based on the person accessing the resource.
    fetchDashboardPitch = async (pitchId: string) => {
        const pitch = await prisma.pitch.findFirst({ 
            where: { 
                id: pitchId,
                status: { not: PitchStatus.DELETED } 
            } 
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        return pitch;
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
    
    updatePitch = async (pitchId: string, payload: UpdatePitchPayloadType) => {
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
                    status: PitchStatus.MAINTENANCE,
                }
            });

            return pitch;
        });

        return updated;
    };

    publishPitch = async (pitchId: string) => {
        // Find the pitch and ensure that it has not been deleted.
        const pitch = await prisma.pitch.findFirst({ where: { id: pitchId, status: { not: PitchStatus.DELETED }}});

        if (!pitch)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Make sure that the status is in a valid state to allow this transition.
        if (pitch.status !== PitchStatus.ACCEPTED && pitch.status !== PitchStatus.MAINTENANCE)
            throw new BadRequestError(`Could not publish pitch because it is currently ${pitch.status.toLowerCase()}.`, ERROR_CODES.PITCH_NOT_ACTIVE);

        const updated = await prisma.$transaction(async tx => {
            const pitch = await tx.pitch.update({ where: { id: pitchId }, data: { status: PitchStatus.LIVE }});

            // Create a pitchEvent to keep track of the status changes.
            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    status: PitchStatus.LIVE,
                }
            });

            return pitch;
        });

        return updated;
    };

    // Todo: Create a better command line interface to approve the pitch.
    static approvePitch = async (pitchId: string) => {        
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
        await PitchService.enqueueGroundSlotGeneration(pitchId, grounds);
    };

    fetchAvailability = async (pitchId: string, date: Date) => {
        // Make sure that the pitch is not deleted and active first before attempting to build the availability.
        const pitch = await prisma.pitch.findFirst({ 
            where: { 
                id: pitchId, 
                status: { not: PitchStatus.DELETED },
            },
            include: {
                grounds: {
                    where: {
                        status: {
                            not: GroundStatus.DELETED
                        }
                    }
                }
            }
        });

        if (!pitch)
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Could not query availability for the specified pitch. Pitch needs to be active first.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Start building the query's startDate, endDate, and grounds.
        const grounds = pitch.grounds;

        const start = startOfWeek(date);
        const end = endOfWeek(date);

        const rawSlots = await prisma.groundSlot.findMany({
            where: {
                pitchId,
                startsAt: { gte: start, lte: end }
            },
            select: {
                groundId: true,
                startsAt: true,
                status: true,
            }
        });

        const slots = formatPitchAvailabilityQuery(rawSlots);

        return { slots, grounds };
    };
    
    queryPitches = async (payload: QueryPitchesPayloadType) => {
        const limit = 20;
        const { filters, location, availability, cursor } = payload;

        // Build dynamic SQL conditions for Phase 1.
        // We use parameterized queries to prevent SQL injection.
        const conditions: string[] = ["status = 'LIVE'"];
        const params: any[] = [];

        if (filters?.sports?.length) {
            params.push(filters.sports);
            conditions.push(`sports && $${params.length}::"GroundSport"[]`);
        }
        if (filters?.sizes?.length) {
            params.push(filters.sizes);
            conditions.push(`sizes && $${params.length}::"GroundSize"[]`);
        }
        if (filters?.amenities?.length) {
            params.push(filters.amenities);
            conditions.push(`"amenityList" @> $${params.length}::"AmenityName"[]`);
        }
        if (filters?.price?.minimum != null) {
            params.push(filters.price.minimum);
            conditions.push(`"maximumPrice" >= $${params.length}`);
        }
        if (filters?.price?.maximum != null) {
            params.push(filters.price.maximum);
            conditions.push(`"minimumPrice" <= $${params.length}`);
        }
        if (filters?.areaId) {
            params.push(filters.areaId);
            conditions.push(`"areaId" = $${params.length}`);
        }
        if (filters?.governorateId) {
            params.push(filters.governorateId);
            conditions.push(`"areaId" IN (SELECT id FROM "Area" WHERE "governorateId" = $${params.length})`);
        }
        if (filters?.text) {
            params.push(`%${filters.text}%`);
            conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
        }
        
        const sqlWhere = conditions.join(" AND ");

        // Phase 1: Location & Initial Filtering
        let candidateIds: string[] | null = null;

        if (location?.mode === "nearby") {
            const { latitude, longitude, radius } = location;
            const geoParams = [...params, longitude, latitude, radius * 1000];
            const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(`
                SELECT id FROM "Pitch"
                WHERE ${sqlWhere}
                AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($${geoParams.length - 2}, $${geoParams.length - 1}), 4326)::geography, $${geoParams.length})
                ORDER BY location <-> ST_SetSRID(ST_MakePoint($${geoParams.length - 2}, $${geoParams.length - 1}), 4326)::geography
            `, ...geoParams);
            candidateIds = rows.map(r => r.id);
            if (!candidateIds.length) return { type: "list" as const, pitches: [], cursor: null };
        } else if (location?.mode === "map") {
            const { boundingBox, zoomLevel } = location;
            const [minLon, minLat, maxLon, maxLat] = boundingBox;
            const gridSize = getGridSize(zoomLevel);

            if (gridSize) {
                const clusterParams = [...params, minLon, minLat, maxLon, maxLat];
                const clusters = await prisma.$queryRawUnsafe<{ count: number; center: string }[]>(`
                    SELECT COUNT(*)::int AS count, ST_AsGeoJSON(ST_Centroid(ST_Collect(location::geometry))) AS center
                    FROM "Pitch"
                    WHERE ${sqlWhere}
                    AND ST_Within(location::geometry, ST_MakeEnvelope($${clusterParams.length - 3}, $${clusterParams.length - 2}, $${clusterParams.length - 1}, $${clusterParams.length}, 4326))
                    GROUP BY ST_SnapToGrid(location::geometry, ${gridSize})
                `, ...clusterParams);
                return {
                    type: "clusters" as const,
                    data: clusters.map(item => ({
                        count: item.count,
                        center: JSON.parse(item.center).coordinates as [number, number],
                    })),
                };
            }

            const mapParams = [...params, minLon, minLat, maxLon, maxLat];
            const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(`
                SELECT id FROM "Pitch"
                WHERE ${sqlWhere}
                AND ST_Within(location::geometry, ST_MakeEnvelope($${mapParams.length - 3}, $${mapParams.length - 2}, $${mapParams.length - 1}, $${mapParams.length}, 4326))
            `, ...mapParams);
            candidateIds = rows.map(r => r.id);
            if (!candidateIds.length) return { type: "list" as const, pitches: [], cursor: null };
        } else {
            // Standard filtering without geospatial constraints.
            const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(`
                SELECT id FROM "Pitch"
                WHERE ${sqlWhere}
                ORDER BY "createdAt" DESC
            `, ...params);
            candidateIds = rows.map(r => r.id);
            if (!candidateIds.length) return { type: "list" as const, pitches: [], cursor: null };
        }

        // Phase 2 & 3: Fetching with Late Filtering & Pagination
        let results: any[] = [];
        const batchSize = limit * 2;
        
        // Build an index map once for O(1) lookups during pagination.
        const candidateIndexMap = new Map(candidateIds.map((id, i) => [id, i]));
        
        let currentIndex = cursor ? (cursor.sortValue + 1) : 0;

        while (results.length < limit && currentIndex < candidateIds.length) {
            const batchIds = candidateIds.slice(currentIndex, currentIndex + batchSize);
            
            const batchPitches = await prisma.pitch.findMany({
                where: {
                    id: { in: batchIds },
                    ...(filters?.surfaces?.length && { grounds: { some: { surface: { in: filters.surfaces } } } }),
                    ...(filters?.autoConfirm && { grounds: { some: { settings: { autoConfirm: true } } } }),
                },
                select: {
                    id: true,
                    name: true,
                    area: {
                        include: {
                            governorate: true
                        }
                    },
                    latitude: true,
                    longitude: true,
                    amenityList: true,
                    sports: true,
                    sizes: true,
                    grounds: {
                        where: { status: GroundStatus.ACTIVE },
                        select: {
                            id: true,
                            sport: true,
                            surface: true,
                            size: true,
                            basePrice: true,
                            peakPrice: true,
                            discountPrice: true,
                            settings: {
                                select: {
                                    minimumWindow: true,
                                    maximumWindow: true,
                                    minimumDuration: true,
                                    maximumDuration: true,
                                    autoConfirm: true,
                                }
                            }
                        },
                    },
                },
            });

            if (batchPitches.length > 0) {
                // Restore original ranked order.
                batchPitches.sort((a, b) => (candidateIndexMap.get(a.id) ?? 0) - (candidateIndexMap.get(b.id) ?? 0));

                let filtered = batchPitches;

                if (availability) {
                    // Phase 3: Availability & Precise Pricing Validation.
                    filtered = await this.applyAvailabilityFilter(batchPitches, availability, filters?.price);
                } else if (filters?.price) {
                    // Precise Price-Only Filtering:
                    // Filter out pitches where NO grounds match the requested price range.
                    // This is more accurate than the Phase 1 denormalized range pre-filter.
                    filtered = batchPitches.filter(pitch => 
                        pitch.grounds.some(ground => {
                            const min = filters.price?.minimum;
                            const max = filters.price?.maximum;
                            // Check if the ground's basePrice (or any variation) falls within the user's budget.
                            const prices = [ground.basePrice, ground.peakPrice, ground.discountPrice].filter(p => p != null) as number[];
                            return prices.some(p => (min == null || p >= min) && (max == null || p <= max));
                        })
                    );
                }
                
                results.push(...filtered);
            }

            currentIndex += batchSize;
        }

        const page = results.slice(0, limit);
        
        // Return null cursor if we have no results to prevent client spin loops.
        if (page.length === 0) return { type: "list" as const, pitches: [], cursor: null };

        const hasNextPage = results.length > limit || currentIndex < candidateIds.length;
        const last = page[page.length - 1];
        
        const lastIndex = candidateIndexMap.get(last.id);
        if (lastIndex === undefined) throw new InternalServerError("Pitch query state inconsistent: last item not in candidate map.", ERROR_CODES.INTERNAL_SERVER_ERROR);

        return {
            type: "list" as const,
            pitches: page,
            cursor: hasNextPage ? { id: last.id, sortValue: lastIndex } : null,
        };
    }
};
