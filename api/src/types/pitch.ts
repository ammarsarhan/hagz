import { PitchStatus, PitchSurface, PitchSize, PitchAmenity } from "@prisma/client";

export type PitchSettingsType = {
    paymentPolicy: string,
    refundPolicy: string
}

export type PitchCreateRequestType = {
    name: string,
    description: string,
    owner: string,
    coordinates: {
        longitude: number,
        latitude: number
    },
    size: PitchSize,
    surface: PitchSurface,
    amenities: PitchAmenity[],
    images: string[],
    price: number,
    settings: PitchSettingsType,
    minimumSession: number,
    maximumSession: number
}

export type PitchResponseType = {
    id: string,
    ownerId: string,
    name: string,
    description: string,
    owner: string,
    coordinates: {
        longitude: number,
        latitude: number
    },
    status: PitchStatus,
    size: PitchSize,
    surface: PitchSurface,
    amenities: PitchAmenity[],
    images: string[],
    price: number,
    settings: PitchSettingsType,
    minimumSession: number,
    maximumSession: number,
    createdAt: string,
    updatedAt: string
}