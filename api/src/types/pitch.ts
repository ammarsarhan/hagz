export type PitchStatusType = "ACTIVE" | "MAINTENANCE" | "CLOSED";
export type PitchPolicyType = "DEFAULT" | "EXTENDED" | "SHORT";
export type PitchSizeType = "FIVE_A_SIDE" | "SEVEN_A_SIDE" | "ELEVEN_A_SIDE";
export type PitchSurfaceType = "GRASS" | "ARTIFICIAL";
export type PitchAmenityType = "INDOORS" | "BALL_PROVIDED" | "SEATING" | "NIGHT_LIGHTS" | "PARKING" | "SHOWERS" | "CHANGING_ROOMS" | "CAFETERIA" | "FIRST_AID" | "SECURITY";

export type PitchCreateRequestType = {
    name: string,
    description: string,
    owner: string,
    coordinates: {
        longitude: number,
        latitude: number
    },
    size: PitchSizeType,
    surface: PitchSurfaceType,
    amenities: PitchAmenityType[],
    images: string[],
    price: number,
    policy: PitchPolicyType,
    minimumSession: number,
    maximumSession: number
}

export type PitchCreateResponseType = {
    id: string,
    ownerId: string,
    name: string,
    description: string,
    owner: string,
    coordinates: {
        longitude: number,
        latitude: number
    },
    size: PitchSizeType,
    surface: PitchSurfaceType,
    amenities: PitchAmenityType[],
    images: string[],
    price: number,
    policy: PitchPolicyType,
    minimumSession: number,
    maximumSession: number,
    createdAt: string,
    updatedAt: string
}