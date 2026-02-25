import { v4 as uuidv4 } from 'uuid';
import { Ground, Pitch } from "@/app/utils/types/dashboard";
import { GroundSize } from "@/app/utils/types/dashboard";

const PITCH_SIZE = {
    columns: 16,
    rows: 16,
    cell: 50
};

const GROUND_SIZES: Record<GroundSize, { width: number, height: number }> = {
    FIVE_A_SIDE: { width: 4, height: 2 },
    SEVEN_A_SIDE: { width: 6, height: 3 },
    ELEVEN_A_SIDE: { width: 8, height: 5 },
    DEFAULT: { width: 4, height: 2 },
};

const pitch: Pitch = {
    id: uuidv4(),
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
    layout: {
        grounds: [],
        combinations: []
    }
};

const ground: Ground = {
    id: uuidv4(),
    name: "",
    description: "",
    sport: "FOOTBALL",
    surface: "ARTIFICIAL_TURF",
    size: "FIVE_A_SIDE",
    paymentMethods: ["CASH", "CREDIT_CARD", "WALLET"],
    policy: "MODERATE",
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
    ],
    x: 0,
    y: 0,
    width: GROUND_SIZES.FIVE_A_SIDE.width,
    height: GROUND_SIZES.FIVE_A_SIDE.height,
};

const defaults = {
    PITCH_SIZE,
    GROUND_SIZES
};

export { pitch, ground, defaults };
