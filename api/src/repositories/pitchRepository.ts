import cuid from "cuid";
import prisma from "../utils/db";
import { PitchAmenity } from "@prisma/client";
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

export async function fetchInitialPitches(limit: number) {
    try {
        const query = await prisma.$queryRaw`
            SELECT "id", "name", "images", "amenities", "location", "updatedAt", ST_AsGeoJSON("coordinates")::text as "coordinates"
            FROM "Pitch"
            ORDER BY "updatedAt" DESC
            LIMIT ${limit};
        ` as BasePitchQueryResponse[];

        if (query.length < 1) {
            return [];
        }

        for (const pitch of query) {
            pitch.coordinates = JSON.parse(pitch.coordinates);
    
            const price = await getPitchPriceRange(pitch.id);
            pitch.priceRange = price;
        };
        
        return query;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchPitchesWithCursor(limit: number, cursor: string) {
    try {
        const query = await prisma.$queryRaw`
            SELECT "id", "name", "images", "amenities", "location", "updatedAt", ST_AsGeoJSON("coordinates")::text as "coordinates"
            FROM "Pitch"
            WHERE "updatedAt" < CAST(${cursor} AS TIMESTAMP)
            ORDER BY "updatedAt" DESC
            LIMIT ${limit};
        ` as BasePitchQueryResponse[];

        if (query.length < 1) {
            return []
        };

        for (const pitch of query) {
            pitch.coordinates = JSON.parse(pitch.coordinates);
    
            const price = await getPitchPriceRange(pitch.id);
            pitch.priceRange = price;
        };

        return query;
    } catch (error: any) {
        throw new Error(error.message);
    }
}