import { PitchStatus, PitchSurface, PitchSize, PitchAmenity } from "@prisma/client";

export type PitchSettingsType = {
    automaticApproval: boolean,
    paymentPolicy: "SHORT" | "DEFAULT" | "EXTENDED",
    refundPolicy: "PARTIAL" | "FULL"
}

export type PitchLocationType = {
    street: string,
    district: string,
    city: string,
    governorate: string,
    country: string
    postalCode?: number
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
    location: PitchLocationType,
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