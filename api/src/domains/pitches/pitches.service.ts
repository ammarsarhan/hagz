import type { CreatePitchPayloadType } from "@/domains/pitches/pitches.validator.js";
import { PermissionsRole, PitchStatus } from "@/generated/prisma/enums.js";
import { BadRequestError, ERROR_CODES } from "@/shared/lib/error.js";
import prisma from "@/shared/lib/prisma.js";

export default class PitchService {
    private readonly MAXIMUM_PITCHES_PER_USER = 5;

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
    
            if (permissions.length >= this.MAXIMUM_PITCHES_PER_USER) throw new BadRequestError(`You may not create more than ${this.MAXIMUM_PITCHES_PER_USER} pitches. If this is an intended action, please get in touch with customer support.`, ERROR_CODES.USER_EXCEEDED_PITCH_CREATE_LIMIT);
    
            const pitches = permissions.map(item => item.pitch);
            const statuses = [PitchStatus.DRAFT, PitchStatus.SUBMITTED] as PitchStatus[];
    
            if (pitches.some(pitch => statuses.includes(pitch.status))) throw new BadRequestError("You already have a pending pitch. This means you already have a pitch draft or have submitted a request to have your pitch added.", ERROR_CODES.USER_PITCH_DRAFT_EXISTS);
    
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
        })
    }
}