import type { CreatePitchAmenityPayloadType, UpdatePitchAmenityPayloadType } from "@/domains/pitches/pitches.validator.js";
import { PitchStatus } from "@/generated/prisma/enums.js";
import config from "@/shared/config.js";
import { BadRequestError, ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import prisma from "@/shared/lib/utils/prisma.js";
import { UNIQUE_AMENITIES } from "@/shared/types/amenity.js";

export default class AmenityService {
    createPitchAmenity = async (pitchId: string, payload: CreatePitchAmenityPayloadType) => {
        // Find the pitch and make sure it is in an editable state.
        const pitch = await prisma.pitch.findFirst({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                amenities: true
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_EDITABLE);

        // Make sure the pitch does not have more than 10 amenity records.
        if (pitch.amenities.length > config.MAXIMUM_AMENITIES_PER_PITCH) throw new BadRequestError(`Pitch may not have more than ${config.MAXIMUM_AMENITIES_PER_PITCH} amenities. Please delete one or try updating it first.`, ERROR_CODES.PITCH_AMENITY_LIMIT_EXCEEDED);

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
        const pitch = await prisma.pitch.findFirst({
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
        const pitch = await prisma.pitch.findFirst({
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
        const pitch = await prisma.pitch.findFirst({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                amenities: true
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_EDITABLE);

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
        const pitch = await prisma.pitch.findFirst({
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            include: {
                amenities: true
            }
        });

        if (!pitch) throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);
        if (!config.EDITABLE_STATES.includes(pitch.status)) throw new BadRequestError("Pitch is not active or cannot accept ground edits right now. Please try again later.", ERROR_CODES.PITCH_NOT_EDITABLE);

        const target = pitch.amenities.find(a => a.order === order);
        if (!target) throw new NotFoundError("Could not find amenity with the specified order.", ERROR_CODES.PITCH_AMENITY_NOT_FOUND);

        if (pitch.status === PitchStatus.LIVE && pitch.amenities.length <= 1)
            throw new BadRequestError("Could not delete pitch amenity. There must be at least one amenity for an active pitch.", ERROR_CODES.PITCH_AMENITY_REQUIRED);

        return await prisma.$transaction(async (tx) => {
            // Delete the amenity.
            await tx.amenity.delete({
                where: { pitchId_order: { pitchId, order } }
            });

            // Reorder the remaining amenities so there are no gaps.
            const remaining = pitch.amenities
                .filter(a => a.order !== order)
                .sort((a, b) => a.order - b.order);

            for (let i = 0; i < remaining.length; i++) {
                const a = remaining[i];
                await tx.amenity.update({
                    where: { pitchId_order: { pitchId, order: a.order } },
                    data: { order: i + 1 }
                });
            }

            // Sync the denormalized amenity list.
            await tx.pitch.update({
                where: { id: pitchId },
                data: { amenityList: remaining.map(a => a.name) }
            });
        });
    };
}