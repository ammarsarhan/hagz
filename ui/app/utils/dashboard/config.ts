const config = {
    MIN_BOOKING_LIMIT: 1,
    MAX_BOOKING_LIMIT: 6,
    defaults: {
        pitch: {
            nameEn: "",
            nameAr: "",
            descriptionEn: "",
            descriptionAr: "",
            taxId: "",
            street: "",
            area: "",
            city: "",
            country: "EG",
            googleMapsLink: "",
            amenities: [
                {
                    name: "",
                    description: "",
                    isPaid: false,
                    price: ""
                }
            ],
            images: [],
            coverImage: "",
            layout: {
                
            }
        },
        ground: {
            nameEn: "",
            nameAr: "",
            descriptionEn: "",
            descriptionAr: "",
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
        },
        permissions: {
            bookings: "WRITE",
            analytics: "READ",
            team: "READ",
            payments: "NONE",
            reports: "READ",
            settings: "READ"
        }
    }
};

export default config;
