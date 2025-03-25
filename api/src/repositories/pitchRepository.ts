import cuid from "cuid";
import prisma from "../utils/db";
import { PitchAmenity } from "@prisma/client";

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
    price: number,
    amenities: PitchAmenity[],
    location: PitchLocation,
    coordinates: string,
    updatedAt: string
}

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
    maximumSession: number,
    price: number,
    location: PitchLocation,
    settings: PitchSettings

}) {
    try {
        const query = await prisma.$queryRaw`
            INSERT INTO "Pitch" ("id", "ownerId", "name", "description", "coordinates", "images", "price", "amenities", "location", "settings", "minimumSession", "maximumSession", "createdAt", "updatedAt")
            VALUES (
                ${cuid()},
                ${data.ownerId},
                ${data.name},
                ${data.description},
                ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326),
                ${data.images}::text[],
                ${data.price},
                ${data.amenities}::"PitchAmenity"[],
                ${data.location},
                ${data.settings},
                ${data.minimumSession},
                ${data.maximumSession},
                NOW(),
                NOW()
            )
            RETURNING 
                "id", "name", "description", "images", "price", "amenities", "location", ST_AsGeoJSON("coordinates")::text as "coordinates";
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
            SELECT "id", "name", "description", "images", "price", "amenities", "location", "updatedAt", ST_AsGeoJSON("coordinates")::text as "coordinates"
            FROM "Pitch" 
            WHERE "id" = ${id}
        ` as PitchQueryResponse[];

        if (query.length < 1) {
            throw new Error("Could not find pitch with specified ID.");
        }

        const result = query[0];
        result.coordinates = JSON.parse(result.coordinates);

        return result;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchInitialPitches(limit: number) {
    try {
        const query = await prisma.$queryRaw`
            SELECT "id", "name", "images", "price", "amenities", "location", "updatedAt", ST_AsGeoJSON("coordinates")::text as "coordinates"
            FROM "Pitch"
            ORDER BY "updatedAt" DESC
            LIMIT ${limit};
        ` as BasePitchQueryResponse[];

        if (query.length < 1) {
            return [];
        }

        query.map(pitch => {
            pitch.coordinates = JSON.parse(pitch.coordinates);
        });

        return query;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchPitchesWithCursor(limit: number, cursor: string) {
    try {
        const query = await prisma.$queryRaw`
            SELECT "id", "name", "images", "price", "amenities", "location", "updatedAt", ST_AsGeoJSON("coordinates")::text as "coordinates"
            FROM "Pitch"
            WHERE "updatedAt" < CAST(${cursor} AS TIMESTAMP)
            ORDER BY "updatedAt" DESC
            LIMIT ${limit};
        ` as BasePitchQueryResponse[];

        if (query.length < 1) {
            return []
        }

        query.map(pitch => {
            pitch.coordinates = JSON.parse(pitch.coordinates);
        })

        return query;
    } catch (error: any) {
        throw new Error(error.message);
    }
}