import prisma from "../utils/db";
import { PitchCreateResponseType, PitchCreateRequestType } from "../types/pitch";

function formatResult(data: any) {
    data.map((el: any) => {
        const point = JSON.parse(el.coordinates);

        el.coordinates = {
            longitude: point.coordinates[0],
            latitude: point.coordinates[1]
        };
    });

    return data as PitchCreateResponseType;
};

export async function getPitch(id: string) {
    try {
        const pitch = await prisma.$queryRaw`
            SELECT
                "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                ST_AsGeoJSON("coordinates")::text as "coordinates",
                "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt"
            FROM "Pitch"
            WHERE "id" = ${id};
        `;

        if (!pitch) {
            throw new Error("Could not find pitch with specified credentials.");
        }

        return formatResult(pitch);
    } catch (error: any) {
        throw new Error(`Could not fetch pitch. ${error.message}`)
    }
}

export async function createPitch(pitch: PitchCreateRequestType) {
    try {
        const data: any = await prisma.$queryRaw`
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

            RETURNING
                "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                ST_AsGeoJSON("coordinates")::text as "coordinates",
                "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt";
        `;
        
        if (data.length < 1) {
            throw new Error("Failed to create new pitch. Please try again later.");
        }

        return formatResult(data);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function queryByLocation(lng: number, lat: number, radius: number) {
    try {    
        const pitches = await prisma.$queryRaw`
            SELECT
                "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                ST_AsGeoJSON("coordinates")::text as "coordinates",
                "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt"
            FROM "Pitch"
            WHERE ST_DWithin("coordinates", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), ${radius});
        `;

        return formatResult(pitches);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchPitchPageData(cursor: string, limit: number) {
    
}