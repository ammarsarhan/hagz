import prisma from "../utils/db";
import { PitchCreateRequestType, PitchResponseType } from "../types/pitch";
import cuid from "cuid";

function formatRawQueryResult(data: any) {
    data.map((el: any) => {
        const point = JSON.parse(el.coordinates);

        el.coordinates = {
            longitude: point.coordinates[0],
            latitude: point.coordinates[1]
        };
    });

    return data as PitchResponseType[];
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

        return formatRawQueryResult(pitch)[0];
    } catch (error: any) {
        throw new Error(`Could not fetch pitch. ${error.message}`)
    }
}

export async function createPitch(pitch: PitchCreateRequestType) {
    try {
        const data: any = await prisma.$queryRaw`
            INSERT INTO "Pitch" ("id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", "coordinates", "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt") 
            VALUES (
                ${cuid()}, 
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

        return formatRawQueryResult(data);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getInitialPitches(limit: number) {
    try {
        const pitches = await prisma.$queryRaw`
            SELECT
                "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                ST_AsGeoJSON("coordinates")::text as "coordinates",
                "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt"
            FROM "Pitch"
            ORDER BY "updatedAt" DESC
            LIMIT ${limit};
        `;

        return formatRawQueryResult(pitches);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getPitchesByCursor(cursor: string, limit: number) {
    try {
        const pitches = await prisma.$queryRaw`
            SELECT
                "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                ST_AsGeoJSON("coordinates")::text as "coordinates",
                "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt"
            FROM "Pitch"
            WHERE "updatedAt" < CAST(${cursor} AS TIMESTAMP)
            ORDER BY "updatedAt" DESC, "id" DESC
            LIMIT ${limit};
        `

        return formatRawQueryResult(pitches);
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

        return formatRawQueryResult(pitches);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function updateField(id: string, ownerId: string, field: string, value: any) {
    try {
        const pitch = await getPitch(id);
        
        if (!pitch) {
            throw new Error("The requested pitch does not exist.");
        }

        if (pitch.ownerId !== ownerId) {
            throw new Error("You do not have the required permissions to access this service.");
        }

        if (field == "longitude" || field == "latitude") {
            const setLongitude = field === "longitude" ? value : pitch.coordinates.longitude;
            const setLatitude = field === "latitude" ? value : pitch.coordinates.latitude;

            const updated = await prisma.$queryRawUnsafe(
                `
                    UPDATE "Pitch"
                    SET "coordinates" = ST_SetSRID(ST_MakePoint($1, $2), 4326)
                    WHERE "id" = $3
                    RETURNING 
                        "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                        ST_AsGeoJSON("coordinates")::text as "coordinates",
                        "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt";
                `,
                setLongitude, setLatitude, id
            );


            if (!updated) {
                throw new Error("Could not update pitch location. Please try again later.")
            }

            return formatRawQueryResult(updated);
        } else {
            const updated = await prisma.pitch.update({
                where: {
                    id: id
                },
                data: {
                    [field]: value
                },
                include: {
                    owner: true
                }
            })

            if (!updated) {
                throw new Error("Could not update pitch data. Please try again later.")
            }

            const formatted = {
                ...updated,
                owner: updated.owner.id,
                coordinates: {
                    longitude: pitch.coordinates.longitude,
                    latitude: pitch.coordinates.latitude
                },
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
            };

            return formatted as PitchResponseType;
        }

    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function searchPitches(keywords: string) {
    try {
        const pitches = await prisma.$queryRaw`
            SELECT
                "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                ST_AsGeoJSON("coordinates")::text as "coordinates",
                "policy", "minimumSession", "maximumSession", "createdAt", "updatedAt"
            FROM "Pitch"
            WHERE search @@ to_tsquery('english', ${keywords})
            ORDER BY ts_rank(search, to_tsquery('english', ${keywords})) DESC;
        `;
    
        if (!pitches) {
            throw new Error("Failed to search for pitches. Please try again later.");
        }
    
        return formatRawQueryResult(pitches);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function checkIfPitchExists(id: string) {
    try {
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: id
            }
        });

        if (!pitch) {
            return false;
        }

        return true;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function validatePitchOwnership(id: string, ownerId: string) {
    try {
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: id,
                ownerId: ownerId
            }
        });

        if (!pitch) {
            return false;
        };

        return true;
    } catch (error: any) {
        throw new Error(error.message);
    }
}