import cuid from "cuid";
import prisma from "../utils/db";
import { GroundSize, GroundSurface, PitchAmenity } from "@prisma/client";
import { getPitchPriceRange } from "./groundRepository";

type PitchLocation = {
    street: string,
    district: string,
    city: string,
    governorate: string,
    country: string,
    postalCode?: number,
    externalLink?: string
};

type PitchSettings = {
    automaticApproval: boolean,
    paymentPolicy: "SHORT" | "DEFAULT" | "EXTENDED",
    refundPolicy: "PARTIAL" | "FULL"
};

type BasePitchQueryResponse = {
    id: string,
    name: string,
    images: string[],
    priceRange: number[],
    amenities: PitchAmenity[],
    location: PitchLocation,
    coordinates: string,
    updatedAt: string
};

type PitchQueryResponse = BasePitchQueryResponse & { description: string };

type FiltersType = {
    startDate: string | null,
    endDate: string | null,
    minimumPrice: number,
    maximumPrice: number,
    target: {
        longitude: number | null,
        latitude: number | null
    },
    radius: number | null,
    size: GroundSize[],
    surface: GroundSurface[],
    amenities: PitchAmenity[]
}

const buildQuery = ({ limit, cursor, startDate, endDate, minimumPrice, maximumPrice, target, radius, size, surface, amenities } : { limit: number, cursor?: string } & FiltersType) => {
    let where: string[] = [];
    let params: any[] = [];

    let index = 1;

    let query = `
        SELECT DISTINCT "p"."id", "p"."name", "p"."images", "p"."amenities", 
                        "p"."location", "p"."updatedAt", ST_AsGeoJSON("p"."coordinates")::text as "coordinates"
        FROM "Pitch" AS p
        JOIN "Ground" AS g ON "g"."pitchId" = "p"."id"
        LEFT JOIN "Reservation" AS r 
            ON "r"."groundId" = "g"."id"
            AND "r"."status" IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
    `;

    if (cursor) {
        where.push(`"p"."updatedAt" < $${index}::TIMESTAMP`);
        params.push(cursor);
        index += 1;
    }

    if (startDate && endDate) {
        where.push(`("r"."id" IS NULL OR NOT ("r"."startDate" < $${index}::TIMESTAMP AND "r"."endDate" > $${index + 1}::TIMESTAMP))`);
        params.push(endDate, startDate);
        index += 2;
    };

    if (minimumPrice && maximumPrice) {
        where.push(`"g"."price" >= $${index} AND "g"."price" <= $${index + 1}`);
        params.push(minimumPrice, maximumPrice);
        index += 2;
    }

    if (radius && target.longitude && target.latitude) {
        where.push(`ST_DWithin("p"."coordinates", ST_SetSRID(ST_MakePoint($${index}, $${index + 1}), 4326), $${index + 2})`);
        params.push(target.longitude, target.latitude, radius);
        index += 3;
    }

    if (size.length > 0) {
        where.push(`"g"."size" = ANY($${index}::"GroundSize"[])`);
        params.push(size);
        index += 1;
    }

    if (surface.length > 0) {
        where.push(`"g"."surface" = ANY($${index}::"GroundSurface"[])`);
        params.push(surface);
        index += 1;
    }

    if (amenities.length > 0) {
        where.push(`"p"."amenities" @> $${index}::"PitchAmenity"[]`);
        params.push(amenities);
        index += 1;
    }

    if (where.length > 0) {
        query += " WHERE " + where.join(" AND ");
    }

    query += ` ORDER BY "p"."updatedAt" DESC LIMIT $${index}`;
    params.push(limit);

    return { query, params };
}

export async function createPitch(data: {
    ownerId: string,
    name: string,
    description: string,
    images: string[],
    amenities: PitchAmenity[],
    longitude: number,
    latitude: number,
    minimumSession: number,
    maximumSession: number
    location: PitchLocation,
    settings: PitchSettings
}) {
    try {
        const query = await prisma.$queryRaw`
            INSERT INTO "Pitch" ("id", "ownerId", "name", "description", "coordinates", "images", "amenities", "location", "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt")
            VALUES (
                ${cuid()},
                ${data.ownerId},
                ${data.name},
                ${data.description},
                ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326),
                ${data.images}::text[],
                ${data.amenities}::"PitchAmenity"[],
                ${data.location},
                ${data.settings},
                ${data.minimumSession},
                ${data.maximumSession},
                NOW(),
                NOW()
            )
            RETURNING 
                "id", "name", "description", "images", "amenities", "location", ST_AsGeoJSON("coordinates")::text as "coordinates";
        ` as PitchQueryResponse[];

        if (query.length < 1) {
            throw new Error("Failed to create pitch. Please try again later.");
        }

        const result = query[0];
        result.coordinates = JSON.parse(result.coordinates);

        return result;
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export async function getPitch(id: string) {
    try {
        const query = await prisma.$queryRaw`
            SELECT "id", "name", "description", "images", "amenities", "location", "updatedAt", ST_AsGeoJSON("coordinates")::text as "coordinates"
            FROM "Pitch" 
            WHERE "id" = ${id}
        ` as PitchQueryResponse[];

        if (query.length < 1) {
            throw new Error("Could not find pitch with specified ID.");
        }

        const result = query[0];
        result.coordinates = JSON.parse(result.coordinates);

        const price = await getPitchPriceRange(id);
        result.priceRange = price;

        return result;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchInitialPitches(limit: number, filters: FiltersType) {
    try {
        const { query, params } = buildQuery({ limit, ...filters });
        const result = await prisma.$queryRawUnsafe(query, ...params) as BasePitchQueryResponse[];

        for (const pitch of result) {
            pitch.coordinates = JSON.parse(pitch.coordinates);
            pitch.priceRange = await getPitchPriceRange(pitch.id);
        }

        return result;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchPitchesWithCursor(limit: number, cursor: string, filters: FiltersType) {
    try {
        const { query, params } = buildQuery({ limit, cursor, ...filters })
        const result = await prisma.$queryRawUnsafe(query, ...params) as BasePitchQueryResponse[];

        for (const pitch of result) {
            pitch.coordinates = JSON.parse(pitch.coordinates);
    
            const price = await getPitchPriceRange(pitch.id);
            pitch.priceRange = price;
        };

        return result;
    } catch (error: any) {
        throw new Error(error.message);
    }
}