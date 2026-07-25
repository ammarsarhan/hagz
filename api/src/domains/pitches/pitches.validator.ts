import z from "zod";
import { AmenityName, AmenityPrice, BookingStatus, GroundSize, GroundSport, GroundSurface, NotificationEvent, PaymentMethod, PermissionLevel, PitchStatus, PitchTier, SlotStatus, StaffRole } from "@/generated/prisma/enums.js";
import { addDays, addHours, isAfter, isBefore } from "date-fns";

export interface StaffType {
    pitchId: string;
    permissions: any | null;
    role: StaffRole;
};

export type NormalizedPitchFeedType = {
    id: string;
    name: string;
    area: { id: string; name: string };
    governorate: string;
    sports: GroundSport[];
    tier: PitchTier;
    amenities: AmenityName[];
    minimumPrice: number;
    maximumPrice: number;
    averageRating: number | null;
    reviewCount: number;
    media: { url: string } | null;
    isFavorited: boolean;
    distance?: number;
};

export type PitchFeedResponseType = {
    id: string;
    name: string;
    tier: PitchTier;
    location: {
        area: { id: string; name: string };
        governorate: string;
    };
    sports: GroundSport[];
    amenities: AmenityName[];
    pricing: {
        minimum: number;
        maximum: number;
    };
    rating: {
        average: number | null;
        count: number;
    };
    media: { url: string } | null;
    isFavorited: boolean;
    distance: number | null;
    badge: string | null;
};

const trim = 
    (error: string) => z
        .string(error)
        .transform(s => s.trim());

const pitchSchema = z.object({
    name: 
        trim("Pitch name is required.")
        .pipe(
            z
                .string()
                .min(2, "Pitch name must be at least 2 characters.").
                max(100, "Pitch name may not exceed 100 characters.")
        ),
    description: 
        trim("Pitch description is required.")
        .pipe(
            z
                .string()
                .refine(
                    val => { const words = val.split(/\s+/).filter(Boolean); return words.length >= 5 && words.length <= 200; },
                    "Pitch description must be between 5 and 200 words."
                )
    ),
    taxId: z
        .string()
        .length(9, "Tax ID must be exactly 9 characters.")
        .regex(/^\d+$/, "Tax ID must contain numbers only.")
        .nullish(),
    street: 
        trim("Street name is required.")
        .pipe(
            z
                .string()
                .min(3, "Street name must be more than 3 characters long.")
                .max(100, "Street name must be less than 100 characters long.")
            ),
    areaId: z.
        cuid("Area ID is required."),
    googleMapsLink: z
        .url("Please provide a valid Google Maps link."),
});

export const parseGoogleMapsLink = (url: string) => {
    const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            return { 
                type: 'coordinates' as const, 
                latitude: parseFloat(match[1]), 
                longitude: parseFloat(match[2]) 
            };
        }
    }

    const address = url.match(/[?&]q=([^&]+)/);
    if (address && address[1]) {
        return { 
            type: 'address' as const, 
            query: decodeURIComponent(address[1].replace(/\+/g, '%20')) 
        };
    }

    return null;
};

export type CreatePitchPayloadType = z.infer<typeof createPitchSchema>;

export const createPitchSchema = pitchSchema;

export type UpdatePitchPayloadType = z.infer<typeof updatePitchSchema>;

export const updatePitchSchema = pitchSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the specified ground." }
);
const baseGroundSchema = z.object({
    name: 
        trim("Ground name is required.")
        .pipe(
            z
                .string()
                .min(2, "Ground name must be at least 2 characters.")
                .max(100, "Ground name may not exceed 100 characters.")
        ),
    description: 
        trim("Ground description must be valid text.")
        .pipe(
            z
                .string()
                .refine(
                    val => { const words = val.split(/\s+/).filter(Boolean); return words.length >= 5 && words.length <= 200; },
                    "Ground description must be between 5 and 200 words."
                )
        )
        .optional(),
    sport: z
        .enum(Object.values(GroundSport) as [GroundSport, ...GroundSport[]], "Please choose a valid ground sport type."),
    size: z
        .enum(Object.values(GroundSize) as [GroundSize, ...GroundSize[]], "Please choose a valid ground size type."),
    surface: z
        .enum(Object.values(GroundSurface) as [GroundSurface, ...GroundSurface[]], "Please choose a valid ground surface type."),
    basePrice: z
        .number("Ground must have a valid base price set.")
        .min(50, "Base ground price may not be less than 50 EGP per hour.")
        .max(2000, "Base ground price may not be more than 2000 EGP per hour."),
    peakPrice: z
        .number()
        .min(100, "Peak ground price may not be less than 100 EGP per hour.")
        .max(2500, "Ground price may not be more than 2500 EGP per hour.")
        .optional(),
    discountPrice: z
        .number("Ground must have a valid base price set.")
        .min(25, "Ground price may not be less than 25 EGP per hour.")
        .max(1500, "Ground price may not be more than 1500 EGP per hour.")
        .optional()
});

export type CreateGroundPayloadType = z.infer<typeof createGroundSchema>;

export const createGroundSchema = baseGroundSchema
    .refine(
        (data) => data.peakPrice === undefined || data.peakPrice > data.basePrice,
        { message: "Peak price must be greater than the base price.", path: ["peakPrice"] }
    )
    .refine(
        (data) => data.discountPrice === undefined || data.discountPrice < data.basePrice,
        { message: "Discount price must be less than the base price.", path: ["discountPrice"] }
    );

export type UpdateGroundPayloadType = z.infer<typeof updateGroundSchema>;

export const updateGroundSchema = baseGroundSchema
    .partial()
    .refine(
        (data) => Object.keys(data).length > 0,
        { message: "At least one field must be provided to update the specified ground." }
    )
    .refine(
        (data) => data.basePrice === undefined || data.peakPrice === undefined || data.peakPrice > data.basePrice,
        { message: "Peak price must be greater than the base price.", path: ["peakPrice"] }
    )
    .refine(
        (data) => data.basePrice === undefined || data.discountPrice === undefined || data.discountPrice < data.basePrice,
        { message: "Discount price must be less than the base price.", path: ["discountPrice"] }
    );

const groundSettingsSchema = z.object({
    minimumDuration: z
        .int("Minimum duration has to be a valid hour.")
        .min(1, "Minimum duration must be at least 1 hour long.")
        .max(5, "Minimum duration must be 5 hours long at most."),
    maximumDuration: z
        .int("Maximum duration has to be a valid hour.")
        .min(2, "Maximum duration must be at least 2 hours long.")
        .max(6, "Maximum duration must be 6 hours long at most."),
    minimumWindow: z
        .int("Minimum window has to be a valid hour.")
        .min(1, "Minimum window must be at least 1 hour before the booking.")
        .max(72, "Minimum window must be 3 days before the booking at most."),
    maximumWindow: z
        .int("Maximum window has to be a valid hour.")
        .min(1, "Maximum window must be at least 1 hour before the booking.")
        .max(2880, "Maximum window must be 4 months in advance at most."),
    autoConfirm: z.boolean(),
    allowGuestBookings: z.boolean(),
    allowRecurringBookings: z.boolean(),
    maxRecurringSessions: z.
        int("Recurring booking limit must be a valid number.")
        .min(3, "Recurring booking must have at least 3 booking sessions.")
        .max(10, "Recurring booking limit must be up to 10 booking sessions.")
        .nullish(),
    paymentMethods: z
        .array(z.enum(Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]], "Please choose a valid payment method."))
        .min(1, "Ground must have at least one payment method associated with it.")
        .max(Object.values(PaymentMethod).length, `Ground can have up to ${Object.values(PaymentMethod).length} payment methods at most.`),
    allowDeposit: z.boolean(),
    depositPercentage: z
        .int("Deposit percentage must be a valid number.")
        .min(5, "Deposit percentage must be at least 5% of the value of the booking.")
        .max(85, "Deposit percentage may not be greater than 85% of the value of the booking.")
        .nullish(),
    approvalExpiryLimit: z
        .int("Approval expiry limit must be a valid number of minutes.")
        .min(15, "Approval expiry limit must be at least 15 minutes to allow staff a sensible grace period.")
        .max(60, "Approval expiry limit must be 60 minutes at most to allow staff a sensible grace period."),
    paymentExpiryLimit: z
        .int("Payment expiry limit must be a valid number of minutes.")
        .min(15, "Payment expiry limit must be at least 15 minutes to allow the user a sensible payment grace period.")
        .max(60, "Payment expiry limit must be 60 minutes at most to allow the user a sensible payment grace period."),
    allowRescheduling: z.boolean(),
    rescheduleLimit: z
        .int("Reschedule limit must a valid number.")
        .min(2, "Rescheduling limit must be at least 2 hours prior to the booking.")
        .max(48, "Rescheduling limit must be 48 hours prior to the booking at most."),
    fullRefundWindow: z
        .int("Full refund window must a valid number.")
        .min(6, "Full refund window must be at least 6 hours prior to the booking.")
        .max(72, "Full refund window must be 3 days prior to the booking at most."),
    partialRefundWindow: z
        .int("Partial refund window must a valid number.")
        .min(2, "Partial refund window must be at least 2 hours prior to the booking.")
        .max(48, "Partial refund window must be 2 days prior to the booking at most."),
    refundPercentage: z
        .int("Refund percentage must be a valid number.")
        .min(25, "Refund percentage must be at least 25% of the booking price.")
        .max(100, "Refund percentage must be the full booking price at most."),
    notificationsTrigger: z 
        .array(z.enum(Object.values(NotificationEvent) as [NotificationEvent, ...NotificationEvent[]], "Please choose a valid ground action."))
})

export type UpdateGroundSettingsPayloadType = z.infer<typeof updateGroundSettingsSchema>;

export const updateGroundSettingsSchema = groundSettingsSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the specified ground." }
).superRefine((data, ctx) => {
    if (data.minimumDuration !== undefined && data.maximumDuration !== undefined) {
        if (data.minimumDuration >= data.maximumDuration)
            ctx.addIssue({ code: "custom", path: ["maximumDuration"], message: "Maximum duration must be greater than minimum duration." });
    };

    if (data.minimumWindow !== undefined && data.maximumWindow !== undefined) {
        if (data.minimumWindow >= data.maximumWindow)
            ctx.addIssue({ code: "custom", path: ["maximumWindow"], message: "Maximum window must be greater than minimum window." });
    };

    if (data.fullRefundWindow !== undefined && data.partialRefundWindow !== undefined) {
        if (data.fullRefundWindow <= data.partialRefundWindow)
            ctx.addIssue({ code: "custom", path: ["partialRefundWindow"], message: "Partial refund window must be closer to the booking time than the full refund window." });
    };

    if (data.allowRecurringBookings === true && data.maxRecurringSessions === null)
        ctx.addIssue({ code: "custom", path: ["maxRecurringSessions"], message: "Maximum recurring sessions is required when recurring bookings are enabled." });
    
    if (data.allowDeposit === true && data.depositPercentage === null)
        ctx.addIssue({ code: "custom", path: ["depositPercentage"], message: "Deposit percentage is required when deposits are enabled." });
});

const timeRangesSchema = z.array(
    z.object({
        start: z
            .int("Start time must be a valid number.")
            .min(0, "Start time for day may not be less than 00:00.")
            .max(22, "Start time for day may not be more than 11:00."),
        end: z
            .int("End time must be a valid number.")
            .min(1, "End time for day may not be less than 01:00.")
            .max(23, "End time for day may not be more than 12:00.")
    })
    .refine(({ start, end }) => start < end, {
        message: "Start time must be before end time.",
    })
)
.refine((ranges) => ranges.every((range, i) => i === 0 || range.start >= ranges[i - 1].end), "Time ranges must be in order and must not overlap.");

export type UpsertGroundSchemaPayloadType = z.infer<typeof upsertGroundScheduleSchema>;

export const upsertGroundScheduleSchema = z.object({
    isActive: z.boolean(),
    baseHours: timeRangesSchema,
    peakHours: timeRangesSchema,
    discountHours: timeRangesSchema
})
.superRefine(({ isActive, baseHours, peakHours, discountHours }, ctx) => {
    if (isActive && baseHours.length === 0) {
        ctx.addIssue({ code: "custom", path: ["baseHours"], message: "At least one base hour range is required when the schedule is active." });
    }

    if (!isActive && (baseHours.length > 0 || peakHours.length > 0 || discountHours.length > 0)) {
        ctx.addIssue({ code: "custom", path: ["baseHours"], message: "All hour ranges must be empty when the schedule is inactive." });
    }

    const all = [...baseHours, ...peakHours, ...discountHours].sort((a, b) => a.start - b.start);
    const hasOverlap = !all.every((range, i) => i === 0 || range.start >= all[i - 1].end);
    if (hasOverlap) {
        ctx.addIssue({ code: "custom", path: ["baseHours"], message: "Time ranges must not overlap across all hour types." });
    }
});

const pitchAmenitySchema = z.object({
    name: z
        .enum(Object.values(AmenityName) as [AmenityName, ...AmenityName[]], "Amenity must be one of the predefined amenity names."),
    description: 
        trim("Amenity description must be valid text.")
        .pipe(
            z
                .string()
                .refine(
                    val => { const words = val.split(/\s+/).filter(Boolean); return words.length >= 3 && words.length <= 75; },
                    "Amenity description must be between 3 and 75 words."
                )
        )
        .optional(),
    price: z
        .int("Price must be a valid number.")
        .min(5, "Amenity price must be between 5 EGP and 500 EGP.")
        .max(500, "Amenity price must be between 5 EGP and 500 EGP.")
        .optional(),
    unit: z
        .enum(Object.values(AmenityPrice) as [AmenityPrice, ...AmenityPrice[]])
        .optional()
});

export type CreatePitchAmenityPayloadType = z.infer<typeof createPitchAmenitySchema>;

export const createPitchAmenitySchema = pitchAmenitySchema.superRefine((val, ctx) => {
    if (val.price && !val.unit)
        ctx.addIssue({ code: "custom", message: "Amenity price unit is required when a price is provided.", path: ["unit"] });
    if (val.unit && !val.price)
        ctx.addIssue({ code: "custom", message: "Amenity price is required when a price unit is provided.", path: ["price"] });
});

export type UpdatePitchAmenityPayloadType = z.infer<typeof updatePitchAmenitySchema>;

export const updatePitchAmenitySchema = pitchAmenitySchema
    .extend({
        price: z
            .int("Price must be a valid number.")
            .min(5, "Amenity price must be between 5 EGP and 500 EGP.")
            .max(500, "Amenity price must be between 5 EGP and 500 EGP.")
            .nullish(),
        unit: z
            .enum(Object.values(AmenityPrice) as [AmenityPrice, ...AmenityPrice[]])
            .nullish()
    })
    .partial()
    .refine(
        (data) => Object.keys(data).length > 0,
        { message: "At least one field must be provided to update the specified amenity." }
    )
    .superRefine((val, ctx) => {
        const price = val.price != null;
        const unit = val.unit != null;

        if (price && !unit)
            ctx.addIssue({ code: "custom", message: "Amenity price unit is required when a price is provided.", path: ["unit"] });
        if (unit && !price)
            ctx.addIssue({ code: "custom", message: "Amenity price is required when a price unit is provided.", path: ["price"] });
    });

export type CreatePitchMediaPresignLinkPayloadType = z.infer<typeof createPitchMediaPresignLinkSchema>;

export const createPitchMediaPresignLinkSchema = z.object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/mpeg", "video/quicktime"], "Please select a valid media type."),
    size: z.number().positive().max(20 * 1024 * 1024, "Media must be less than 20 MBs."),
})

export type CreateInvitationPayloadType = z.infer<typeof createInvitationSchema>;

export const createInvitationSchema = z.object({
    name: z
        .string("Name is required.")
        .min(2, "Name must be at least 2 characters long.")
        .max(50, "Name may not be longer than 50 characters at most."),
    phone: z
        .string("Phone number is required.")
        .regex(/^\+[1-9]\d{7,14}$/, "Phone number must include the international code and be in an acceptable format."),
    expiresAt: z
        .coerce
        .date()
        .refine((date) => {
            const now = new Date();

            const min = addHours(now, 24);
            const max = addDays(now, 7);

            return isAfter(date, min) && isBefore(date, max);
        }, "Expiration date must be between 24 hours and 7 days from now."),
});

// Probably a better practice to keep the permissions as a separate schema in case we need to use it later.
export const pitchStaffMemberPermissionsSchema = z.object({
    settings: z.enum(Object.values(PermissionLevel)),
    schedule: z.enum(Object.values(PermissionLevel)),
    bookings: z.enum(Object.values(PermissionLevel)),
    analytics: z.enum(Object.values(PermissionLevel)),
    payments: z.enum(Object.values(PermissionLevel)),
    layout: z.enum(Object.values(PermissionLevel)),
    team: z.enum(Object.values(PermissionLevel)),
    properties: z.enum(Object.values(PermissionLevel)),
});

// Intentionally kept as an object within an object in case we need to scale the schema in the future to accept more fields.
export type UpdatePitchStaffMemberPayloadType = z.infer<typeof updatePitchStaffMemberSchema>;

export const updatePitchStaffMemberSchema = z.object({
    permissions: pitchStaffMemberPermissionsSchema
});

const groundSlotTargetSchema = z.enum(["DAY", "WEEK", "MONTH"]);
export type GroundSlotTargetType = z.infer<typeof groundSlotTargetSchema>;

export const fetchGroundSlotsSchema = z.object({
    date: z
        .coerce
        .date("A date is required to fetch slots for the specified ground."),
    target: groundSlotTargetSchema,
    status: z
        .enum(Object.values(SlotStatus))
        .optional()
});

export const UpdateGroundSlotStatus = {
    AVAILABLE: SlotStatus.AVAILABLE,
    INACTIVE: SlotStatus.INACTIVE
};

export type UpdateGroundSlotStatusType = (typeof UpdateGroundSlotStatus)[keyof typeof UpdateGroundSlotStatus];

export const updateGroundSlotSchema = z.object({
    status: z.enum(Object.values(UpdateGroundSlotStatus))
});

export const updateGroundSlotsSchema = z.object({
    targets: z.array(z.cuid("A list of ground slot IDs is required to update."), "An array of slot IDs must be provided."),
    status: z.enum(Object.values(UpdateGroundSlotStatus))
});

export type FetchPitchAvailabilityPayloadType = z.infer<typeof fetchPitchAvailabilitySchema>;

export const fetchPitchAvailabilitySchema = z.object({
    date: z.coerce.date("A date is required to fetch the specified pitch's availability.")
});

export type FetchStaffBookingsFiltersPayloadType = z.infer<typeof getStaffBookingsFiltersSchema>;

export const fetchPitchFeedSchema = z.object({
    longitude: z
        .number("Longitude must be a number.")
        .min(-180, { error: "Longitude must be at least -180." })
        .max(180, { error: "Longitude must be at most 180." })
        .optional(),
    latitude: z
        .number("Latitude must be a number.")
        .min(-90, { error: "Latitude must be at least -90." })
        .max(90, { error: "Latitude must be at most 90." })
        .optional(),
    })
    .refine(
        ({ longitude, latitude }) =>
            (longitude === undefined && latitude === undefined) ||
            (longitude !== undefined && latitude !== undefined),
            "Longitude and latitude must either both be provided or both be omitted.",
    );

export type FetchPitchFeedPayloadType = z.infer<typeof fetchPitchFeedSchema>;

export const createReviewSchema = z.object({
    rating: z
        .int("Rating is required.")
        .min(1, "Rating must be at least 1.")
        .max(5, "Rating may not exceed 5."),
    comment: z
        .string()
        .max(500, "Comment may not exceed 500 characters.")
        .optional()
});

export type CreateReviewPayloadType = z.infer<typeof createReviewSchema>;

export const getStaffBookingsFiltersSchema = z.object({
    status: z
        .enum(Object.values(BookingStatus) as [BookingStatus, ...BookingStatus[]], "Please choose a valid booking status.")
        .optional(),
    startDate: z
        .coerce
        .date("A valid start date is required."),
    endDate: z
        .coerce
        .date("A valid end date is required."),
    page: z
        .int("Page must be a valid number.")
        .min(1, "Page must be at least 1."),
    limit: z
        .int("Limit must be a valid number.")
        .min(1, "Limit must be at least 1.")
        .max(100, "Limit may not exceed 100 results per page."),
})
.refine(
    ({ startDate, endDate }) => startDate <= endDate,
    { message: "Start date must be before or equal to the end date.", path: ["endDate"] }
);

export const normalizeRawPitchFeed = (raw: any, favorited: Set<string>): NormalizedPitchFeedType => {
    const isRawQuery = raw.area_id !== undefined;

    const name = raw.translations?.[0]?.name ?? raw.name;

    const area = isRawQuery
        ? (raw.area_translated_name ?? raw.area_name)
        : (raw.area?.translations?.[0]?.name ?? raw.area?.name);

    const governorate = isRawQuery
        ? raw.governorate_name
        : raw.area?.governorate?.name;

    return {
        id: raw.id,
        name,
        area: { id: isRawQuery ? raw.area_id : raw.area.id, name: area },
        governorate,
        sports: raw.sports ?? [],
        tier: raw.tier,
        amenities: (raw.amenityList ?? raw.amenity_list ?? []).slice(0, 3),
        minimumPrice: raw.minimumPrice ?? raw.minimum_price ?? null,
        maximumPrice: raw.maximumPrice ?? raw.maximum_price ?? null,
        averageRating: raw.averageRating ?? raw.average_rating ?? null,
        reviewCount: raw.reviewCount ?? raw.review_count ?? 0,
        media: raw.media?.[0] ? { url: raw.media[0].url } : null,
        isFavorited: favorited.has(raw.id),
        ...(raw.distance !== undefined && { distance: Number(raw.distance) }),
    };
};

export const createPitchFeedResponse = (pitches: NormalizedPitchFeedType[], badge?: string): PitchFeedResponseType[] =>
    pitches.map((pitch) => ({
        id: pitch.id,
        name: pitch.name,
        tier: pitch.tier,
        location: {
            area: pitch.area,
            governorate: pitch.governorate,
        },
        sports: pitch.sports,
        amenities: pitch.amenities,
        pricing: {
            minimum: pitch.minimumPrice,
            maximum: pitch.maximumPrice,
        },
        rating: {
            average: pitch.averageRating,
            count: pitch.reviewCount,
        },
        media: pitch.media,
        isFavorited: pitch.isFavorited,
        distance: pitch.distance ?? null,
        badge: badge ?? null,
    }));