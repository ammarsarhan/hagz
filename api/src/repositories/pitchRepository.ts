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
    updatedAt: string,
    grounds: number,
    minimumSession: number,
    maximumSession: number,
    openFrom: string,
    openTo: string,
    automaticApproval: boolean,
    paymentPolicy: "SHORT" | "DEFAULT" | "EXTENDED",
    refundPolicy: "PARTIAL" | "FULL"
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
                        "p"."location", "p"."updatedAt", ST_AsGeoJSON("p"."coordinates")::text as "coordinates",
                        COUNT("g"."id")::INTEGER AS "grounds"
        FROM "Pitch" AS p
        JOIN "Ground" AS g ON "g"."pitchId" = "p"."id"
        LEFT JOIN "Reservation" AS r 
            ON "r"."groundId" = "g"."id"
            AND "r"."status" IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
    `;

    if (cursor) {
        where.push(`"p"."updatedAt" < $${index}::TIMESTAMP`);
        params.push(cursor);
        index++;
    }

    // handle checking if open and close times are valid here?
    if (startDate && endDate) {
        where.push(`("r"."id" IS NULL OR NOT ("r"."startDate" < $${index}::TIMESTAMP AND "r"."endDate" > $${index + 1}::TIMESTAMP))`);
        params.push(endDate, startDate);
        index += 2;
    }

    if (minimumPrice && maximumPrice) {
        where.push(`
            EXISTS (
                SELECT * FROM "Ground" AS g
                WHERE g."pitchId" = p."id"
                AND g."price" BETWEEN $${index} AND $${index + 1}
            )
        `);
        params.push(minimumPrice, maximumPrice);
        index += 2;
    };

    if (radius && target?.longitude && target?.latitude) {
        where.push(`ST_DWithin("p"."coordinates", ST_SetSRID(ST_MakePoint($${index}, $${index + 1}), 4326), $${index + 2})`);
        params.push(target.longitude, target.latitude, radius);
        index += 3;
    }

    if (size?.length) {
        where.push(`"g"."size" = ANY($${index}::"GroundSize"[])`);
        params.push(size);
        index++;
    }

    if (surface?.length) {
        where.push(`"g"."surface" = ANY($${index}::"GroundSurface"[])`);
        params.push(surface);
        index++;
    }

    if (amenities?.length) {
        where.push(`"p"."amenities" @> $${index}::"PitchAmenity"[]`);
        params.push(amenities);
        index++;
    }

    if (where.length) {
        query += " WHERE " + where.join(" AND ");
    }

    query += ` GROUP BY "p"."id" ORDER BY "p"."updatedAt" DESC LIMIT $${index}`;
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
    settings: PitchSettings,
    openFrom: string,
    openTo: string
}) {
    try {
        const query = await prisma.$queryRaw`
            INSERT INTO "Pitch" ("id", "ownerId", "name", "description", "coordinates", "images", "amenities", "location", "settings", "minimumSession", "maximumSession", "openFrom", "openTo", "createdAt", "updatedAt")
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
                ${data.openFrom},
                ${data.openTo},
                NOW(),
                NOW()
            )
            RETURNING 
                "id", "name", "description", "images", "amenities", "location", ST_AsGeoJSON("coordinates")::text as "coordinates", "minimumSession", "maximumSession", "openFrom", "openTo";
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
            SELECT 
                "p"."id", "p"."name", "p"."description", "p"."images", 
                "p"."amenities", "p"."location", "p"."updatedAt", 
                "p"."minimumSession", "p"."maximumSession", "p"."openFrom", "p"."openTo",
                ST_AsGeoJSON("p"."coordinates")::text AS "coordinates",
                COUNT("g"."id")::INTEGER AS "grounds",
                "p"."settings"->>'automaticApproval' AS "automaticApproval",
                "p"."settings"->>'paymentPolicy' AS "paymentPolicy",
                "p"."settings"->>'refundPolicy' AS "refundPolicy"
            FROM "Pitch" AS p
            LEFT JOIN "Ground" AS g ON "g"."pitchId" = "p"."id"
            WHERE "p"."id" = ${id}
            GROUP BY "p"."id", "p"."name", "p"."description", "p"."images", 
                "p"."amenities", "p"."location", "p"."updatedAt", "p"."coordinates"
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