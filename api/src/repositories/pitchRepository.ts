import prisma from "../utils/db";
import { PitchCreateResponseType, PitchCreateRequestType } from "../types/pitch";

export async function getPitch(id: string) {
    try {
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: id
            }
        })

        if (!pitch) {
            throw new Error("Could not find pitch with specified credentials.");
        }

        return pitch;
    } catch (error: any) {
        throw new Error(`Could not fetch pitch. ${error.message}`)
    }
}

export async function createPitch(pitch: PitchCreateRequestType) {
    try {
        const data: PitchCreateResponseType[] = await prisma.$queryRaw`
            INSERT INTO "Pitch" ("id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", "coordinates", "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt") 
            VALUES (
                gen_random_uuid(), 
                ${pitch.owner}, 
                ${pitch.name},
                ${pitch.description}, 
                ${pitch.size}::"PitchSize", 
                ${pitch.surface}::"PitchSurface", 
                ${pitch.amenities}::"PitchAmenity"[], 
                ${pitch.images}::text[], 
                ${pitch.price}, 
                ST_SetSRID(ST_MakePoint(${pitch.coordinates.longitude}, ${pitch.coordinates.latitude}), 4326), 
                ${pitch.policy}::"PitchPolicy", 
                ${pitch.minimumSession}, 
                ${pitch.maximumSession}, 
                NOW(), 
                NOW()
            )
            RETURNING id;
        `;
        
        if (data.length < 1) {
            throw new Error("Failed to create new pitch. Please try again later.");
        }

        const id = data[0].id;
        return id;
    } catch (error: any) {
        throw new Error(error.message);
    }
}