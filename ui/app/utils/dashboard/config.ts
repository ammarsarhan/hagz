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
    SEVEN_A_SIDE: { width: 8, height: 4 },
    ELEVEN_A_SIDE: { width: 12, height: 6 },
    STANDARD: { width: 4, height: 2 },
};

const pitch = (): Pitch => ({
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
        entrance: {
            axis: "TOP",
            position: "START"
        },
        grounds: [],
        combinations: []
    }
});

const ground = (): Ground => ({
    id: uuidv4(),
    name: "Ground A",
    description: "",
    sport: "FOOTBALL",
    surface: "ARTIFICIAL_TURF",
    size: "FIVE_A_SIDE",
    paymentMethods: ["CASH", "CREDIT_CARD", "WALLET"],
    policy: "MODERATE",
    depositFee: "100",
    basePrice: "400",
    peakPrice: "500",
    discountPrice: "350",
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
        0b0000010001000100010000000,
        0b000000000000000001000000,
        0b0000000000000000100000000,
        0b000000000000001000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
    ],
    peakHours: [
        0b001000000000000000000000,
        0b000000000000000000000000,
        0b001000000000000000000000,
        0b000000000000000000000000,
        0b001000000000000000000000,
        0b000000000000000000000000,
        0b000000000000000000000000,
    ],
    x: 0,
    y: 0,
    w: GROUND_SIZES.FIVE_A_SIDE.width,
    h: GROUND_SIZES.FIVE_A_SIDE.height,
    rotation: 0
});

const defaults = {
    PITCH_SIZE,
    GROUND_SIZES
};

export { pitch, ground, defaults };
