import { CreatePitchFormType } from "@/app/utils/types/dashboard";

const pitch: CreatePitchFormType = {
    name: "",
    description: "",
    taxId: "",
    street: "",
    area: "",
    city: "",
    country: "EG" as const,
    googleMapsLink: "",
    longitude: "",
    latitude: "",
    amenities: [],
    images: [],
    coverImage: "",
    layout: {}
};

const ground = {
    name: "",
    description: "",
    sport: "",
    surface: "",
    size: "",
    images: [],
    paymentMethods: ["CASH", "CREDIT_CARD", "WALLET"],
    policy: "STRICT",
    depositFee: "",
    basePrice: "",
    peakPrice: "",
    discountPrice: "",
    operatingHours: [
        0b111111111111111111111111,
        0b111111111111111111111111,
        0b111111111111111111111111,
        0b111111111111111111111111,
        0b111111111111111111111111,
        0b111111111111111111111111,
        0b111111111111111111111111,
    ],
    discountHours: [
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
    ],
    peakHours: [
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
    ]
};

export { pitch, ground };
