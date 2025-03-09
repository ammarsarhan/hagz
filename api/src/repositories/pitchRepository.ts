import prisma from "../utils/db";
import cuid from "cuid";
import { z } from 'zod';
import { PitchCreateRequestType, PitchResponseType } from "../types/pitch";

function formatRawQueryResult(data: any) {
    data.map((el: any) => {
        if (el.coordinates != null) {
            const point = JSON.parse(el.coordinates);
    
            el.coordinates = {
                longitude: point.coordinates[0],
                latitude: point.coordinates[1]
            };
        }
    });
    
    return data as PitchResponseType[];
};

export async function getPitch(id: string) {
    try {
        const pitch = await prisma.$queryRaw`
            SELECT
                "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                ST_AsGeoJSON("coordinates")::text as "coordinates",
                "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt"
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

export async function getPitchData(id: string, fields: string[]) {
    try {
        const fieldSchema = z.array(z.enum(["id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", "coordinates", "settings", "minimumSession", "maximumSession", "approvalExpiry", "createdAt", "updatedAt"])).nonempty();
        const parsed = fieldSchema.safeParse(fields);

        if (!parsed.success) {
            throw new Error("Please provide a valid field for the specified pitch.");
        }

        const formatFields = (fields: string[]) => {
            let formatted: string = "";
            
            fields.map(field => {
                if (field == "coordinates") {
                    formatted += `ST_AsGeoJSON("coordinates")::text as "coordinates", `;
                    return;
                }

                formatted += `"${field}", `;
            })

            formatted = formatted.slice(0, -2);
            return formatted;
        }

        const formatted = formatFields(parsed.data);
        const data: any[] = await prisma.$queryRawUnsafe(`
            SELECT ${formatted}
            FROM "Pitch"
            WHERE "id" = $1;
        `, id);

        if (data.length < 1) {
            throw new Error("Could not find pitch details for the specified credentials.");
        }

        return data[0];
    } catch (error: any) {
        throw new Error(`Could not fetch pitch data for specified fields. ${error.message}`)
    }
}

export async function createPitch(pitch: PitchCreateRequestType) {
    try {
        const data: any = await prisma.$queryRaw`
            INSERT INTO "Pitch" ("id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", "coordinates", "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt") 
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
                ${pitch.settings},
                ${pitch.minimumSession}, 
                ${pitch.maximumSession},
                NOW(), 
                NOW()
            )

            RETURNING
                "id", "ownerId", "name", "description", "size", "surface", "amenities", "images", "price", 
                ST_AsGeoJSON("coordinates")::text as "coordinates",
                "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt";
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
                "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt"
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
                "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt"
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
                "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt"
            FROM "Pitch"
            WHERE ST_DWithin("coordinates", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), ${radius});
        `;

        return formatRawQueryResult(pitches);
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function updateField(id: string, field: string, value: any) {
    try {
        const pitch = await getPitchData(id, ["coordinates"]);
        
        if (!pitch) {
            throw new Error("The requested pitch does not exist.");
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
                        "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt";
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
                "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt"
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