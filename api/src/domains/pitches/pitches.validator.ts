import z from "zod";
import { AmenityName, AmenityPrice, Country, GroundSize, GroundSport, GroundSurface, NotificationEvent, PaymentMethod, PermissionLevel, SlotStatus, StaffRole } from "@/generated/prisma/enums.js";
import { addDays, addHours, isAfter, isBefore } from "date-fns";

export interface StaffType {
    pitchId: string;
    permissions: any | null;
    role: StaffRole;
}

const trim = 
    (error: string) => z
        .string(error)
        .transform(s => s.trim());

const extractCoordinates = (url: string) => {
    const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
        /%40(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
                return { latitude: lat, longitude: lng };
        }
    };

    return null;
};

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
    area: 
        trim("Area is required.")
        .pipe(
            z
                .string()
                .min(3, "Area name must be more than 3 characters long.")
                .max(100, "Area name must be less than 100 characters long.")
        ),
    city: 
        trim("City is required.")
        .pipe(
            z
                .string()
                .min(3, "City name must be more than 3 characters long.")
                .max(100, "City name must be less than 100 characters long.")
            ),
    country: z
        .enum(Object.values(Country) as [Country, ...Country[]], "Your country may not be supported yet."),
    googleMapsLink: z
        .url("Please provide a valid Google Maps link."),
});

export type CreatePitchPayloadType = z.infer<typeof createPitchSchema>;

export const createPitchSchema = pitchSchema.transform((data, ctx) => {
    const coords = extractCoordinates(data.googleMapsLink);

    if (!coords) {
        ctx.addIssue({ code: "custom", path: ["googleMapsLink"], message: "Could not extract coordinates from this link." });
        return z.NEVER;
    };

    return { ...data, ...coords };
});

export type UpdatePitchPayloadType = z.infer<typeof updatePitchSchema>;

export const updatePitchSchema = pitchSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the specified ground." }
).transform((data, ctx) => {
    if (data.googleMapsLink) {
        const coords = extractCoordinates(data.googleMapsLink);
    
        if (!coords) {
            ctx.addIssue({ code: "custom", path: ["googleMapsLink"], message: "Could not extract coordinates from this link." });
            return z.NEVER;
        };
    
        return { ...data, ...coords };
    };

    return data;
});

export type CreateGroundPayloadType = z.infer<typeof createGroundSchema>;

export const createGroundSchema = z.object({
    name: 
        trim("Ground name is required.")
        .pipe(
            z
                .string()
                .min(2, "Ground name must be at least 2 characters.").
                max(100, "Ground name may not exceed 100 characters.")
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

export type UpdateGroundPayloadType = z.infer<typeof updateGroundSchema>;

export const updateGroundSchema = createGroundSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the specified ground." }
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
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"], "Please select a valid image type."),
    size: z.number().positive().max(5 * 1024 * 1024, "Image must be less than 5 MBs."),
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

export type FetchPitchAvailabilityPayloadType = z.infer<typeof fetchPitchAvailabilitySchema>;

export const fetchPitchAvailabilitySchema = z.object({
    date: z.coerce.date("A date is required to fetch the specified pitch's availability.")
});

export type QueryPitchesPayloadType = z.infer<typeof queryPitchesSchema>;

export const queryPitchesSchema = z.object({
    location: z
        .discriminatedUnion("mode", [
            z.object({
                mode: z.literal("nearby"),
                latitude: z
                    .number("Latitude must be a valid number.")
                    .min(-90, "Latitude must be a valid number between -90 and 90.")
                    .max(90, "Latitude must be a valid number between -90 and 90."),
                longitude: z.
                    number("Longitude must be a valid number.")
                    .min(-180, "Longitude must be a valid number between -180 and 180.")
                    .max(180, "Longitude must be a valid number between -180 and 180."),
                radius: z
                    .number("Search radius must be a valid number.")
                    .min(0.5, "Search radius must be at least 0.5 km.")
                    .max(50, "Search radius may not exceed 50 km."),
            }),
            z.object({
                mode: z.literal("map"),
                boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()], "A valid map viewport is required."),
                zoomLevel: z
                    .int("Zoom level must be a valid number.")
                    .min(0, "Zoom level must be at least 0.")
                    .max(21, "Zoom level may not exceed 21."),
            }),
        ]
    ),
    filters: z
        .object({
            sports: z
                .array(z.enum(Object.values(GroundSport) as [GroundSport, ...GroundSport[]], "Please choose a valid sport type."))
                .optional(),
            sizes: z
                .array(z.enum(Object.values(GroundSize) as [GroundSize, ...GroundSize[]], "Please choose a valid ground size."))
                .optional(),
            surfaces: z
                .array(z.enum(Object.values(GroundSurface) as [GroundSurface, ...GroundSurface[]], "Please choose a valid surface type."))
                .optional(),
            amenities: z
                .array(z.enum(Object.values(AmenityName) as [AmenityName, ...AmenityName[]], "Please choose a valid amenity."))
                .optional(),
            price: z
                .object({
                    minimum: z
                        .number()
                        .int()
                        .nonnegative("Minimum price must be a positive number.")
                        .optional(),
                    maximum: z
                        .number()
                        .int()
                        .nonnegative("Maximum price must be a positive number.")
                        .optional(),
                })
                .refine(
                    ({ minimum, maximum }) => minimum === undefined || maximum === undefined || minimum < maximum,
                    "Minimum price must be less than the maximum price."
                )
                .optional(),
            autoConfirm: z
                .boolean()
                .optional(),
            text: z
                .string("Search query must be a valid string.")
                .min(1, "Search query must be at least 1 character long.")
                .max(100, "Search query may not exceed 100 characters.")
                .optional(),
        })
        .optional(),
    availability: z
        .discriminatedUnion("mode", [
            // User wants a specific date and time — e.g. "Friday the 13th at 8pm for 2 hours."
            z.object({
                mode: z.literal("specific"),
                date: z.coerce.date("A valid date is required to check availability."),
                startHour: z
                    .int("Start hour must be a valid number.")
                    .min(0, "Start hour must be at least 00:00.")
                    .max(23, "Start hour may not be greater than 23:00."),
                durationHours: z
                    .int("Duration must be a valid number of hours.")
                    .min(1, "Booking duration must be at least 1 hour.")
                    .max(6, "Booking duration may not exceed 6 hours."),
            }),
            // User wants the next available date where a specific time is free - e.g. "whenever 8pm to 10pm is next open."
            z.object({
                mode: z.literal("time"),
                startHour: z
                    .int("Start hour must be a valid number.")
                    .min(0, "Start hour must be at least 00:00.")
                    .max(23, "Start hour may not be greater than 23:00."),
                durationHours: z
                    .int("Duration must be a valid number of hours.")
                    .min(1, "Booking duration must be at least 1 hour.")
                    .max(6, "Booking duration may not exceed 6 hours."),
            }),
            // User just wants the next open slot of a given length — e.g. "any next available 2-hour slot."
            z.object({
                mode: z.literal("available"),
                durationHours: z
                    .int("Duration must be a valid number of hours.")
                    .min(1, "Booking duration must be at least 1 hour.")
                    .max(6, "Booking duration may not exceed 6 hours."),
            }),
            // User wants a slot on a specific date that falls within a time band — e.g. "sometime between 6pm and 10pm on Saturday."
            z.object({
                mode: z.literal("window"),
                date: z.coerce.date("A valid date is required to check availability."),
                fromHour: z
                    .int("Start of window must be a valid number.")
                    .min(0, "From hour must be at least 00:00.")
                    .max(22, "From hour must be 22:00 at most."),
                toHour: z
                    .int("End of window must be a valid number.")
                    .min(1, "To hour must be at least 01:00.")
                    .max(23, "To hour must be 23:00 at most."),
                durationHours: z
                    .int("Duration must be a valid number of hours.")
                    .min(1, "Booking duration must be at least 1 hour.")
                    .max(6, "Booking duration may not exceed 6 hours."),
            }),
            // User wants to book the same slot repeatedly — e.g. "every Friday at 8pm for the next 4 weeks."
            z.object({
                mode: z.literal("recurring"),
                startHour: z
                    .int("Start hour must be a valid number.")
                    .min(0, "Start hour must be at least 00:00.")
                    .max(23, "Start hour must be 23:00 at most."),
                durationHours: z
                    .int("Duration must be a valid number of hours.")
                    .min(1, "Booking duration must be at least 1 hour.")
                    .max(6, "Booking duration may not exceed 6 hours."),
                dayOfWeek: z
                    .int("Day of week must be a valid number.")
                    .min(1, "Day of week must be a valid number between 1 to 7.")
                    .max(7, "Day of week must be a valid number between 1 to 7."),
                sessions: z
                    .int("Number of sessions must be a valid number.")
                    .min(2, "Recurring availability must span at least 2 sessions.")
                    .max(10, "Recurring availability may not exceed 10 sessions."),
            }),
        ])
        .optional(),
    cursor: z
        .object({
            id: z.cuid("Cursor must be a valid ID."),
            sortValue: z.number("Cursor sort value must be a valid number."),
        })
        .optional(),
});