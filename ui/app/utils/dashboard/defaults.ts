import { randomUUID } from "crypto";

export const MIN_BOOKING_LIMIT = 1;
export const MAX_BOOKING_LIMIT = 6;

export const pitch = {
    name: "",
    description: "",
    taxId: "",
    street: "",
    area: "",
    city: "",
    country: "EG",
    latitude: "",
    longitude: "",
    googleMapsLink: "",
    images: [""],
    paymentMethods: ["CASH", "CREDIT_CARD", "WALLET"],
    amenities: [
        {
            name: "LIGHTING",
            isPaid: false,
            price: ""
        },
        {
            name: "BALL_PROVIDED",
            isPaid: true,
            price: "50"
        }
    ],
    grounds: [
        {
            id: randomUUID(),
            name: "Ground A",
            description: "",
            price: "200",
            policy: "STRICT",
            autoApproval: true,
            peakMultiplier: "",
            discountMultiplier: "",
            schedule: Array(7).map((_, i) => {
                return {
                    dayOfWeek: i,
                    availableSlots: Array(24).map((_, t) => t),
                    peakHours: [],
                    discountHours: []
                }
            }),
        }
    ],
    layout: {

    }
};
