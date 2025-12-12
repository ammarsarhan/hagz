import { Amenity, BillingMethod, BookingSource, CombinationSize, Country, Ground, GroundSize, GroundSurfaceType, PayoutRate, PitchStatus, UserStatus } from "generated/prisma";
import z from "zod";
import prisma from "./prisma";
import { differenceInHours } from "date-fns";

export type OnboardingStage = "NO_PITCH" | "PITCH_DRAFT" | "PITCH_PENDING" | "PUBLISHING_REQUIRED" | "ACTIVE" | "INACTIVE";
export type DraftStep = "DETAILS" | "SETTINGS" | "LAYOUT" | "SCHEDULE";
export type UserRole = "USER" | "MANAGER" | "OWNER";

export interface PitchDetails {
    name: string;
    basePrice: number;
    taxId: string | null;
    description: string;
    street: string;
    area: string;
    city: string;
    country: Country;
    latitude: number;
    longitude: number;
    googleMapsLink: string;
    images: string[];
    amenities: Amenity[];
};

export interface PitchSettings {
    automaticBookings: boolean;
    minBookingHours: number;
    maxBookingHours: number;
    cancellationFee: number;
    noShowFee: number;
    advanceBooking: number;
    peakHourSurcharge: number;
    offPeakDiscount: number;
    payoutRate: PayoutRate;
};

interface GroundType {
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    images: string[];
    size: GroundSize;
    layoutId: string;
    surfaceType: GroundSurfaceType;
    settings?: LayoutTargetSettings;
    combinations?: CombinationType[];
}

interface CombinationType {
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    size: CombinationSize;
    layoutId: string;
    grounds: GroundType[];
}

export interface PitchLayout {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    pitchId: string;
    combinations: CombinationType[];
    grounds: GroundType[];
    structure: any;
};

export interface PitchSchedule {
    dayOfWeek: number;
    openTime: number;
    closeTime: number;
    peakHours: number[];
    offPeakHours: number[];
};

// Helper utility function to get the user onboarding stage based on their current data status.
export async function getDashboardStage(role: UserRole, id: string): Promise<OnboardingStage> {
    switch (role) {
        case "USER":
            {
                return "ACTIVE";
            }
        case "MANAGER":
            {
                return "ACTIVE";
            }
        case "OWNER":
            {
                const owner = await prisma.owner.findUnique({ where: { userId: id }, include: { pitches: true } });
                if (!owner) throw new Error("Could not find owner data associated with the specified user ID.");
                const pitches = owner.pitches;

            
                // Stage 1: Owner account has no pitches.
                if (pitches.length <= 0) return "NO_PITCH";
            
                // Stage 2: Owner account has one draft pitch.
                if (pitches.length === 1 && pitches.every(pitch => pitch.status === "DRAFT")) return "PITCH_DRAFT";
            
                // Stage 3: Owner account has at least one pitch that is still pending.
                if (pitches.length === 1 && pitches.every(pitch => pitch.status === "PENDING")) return "PITCH_PENDING";
            
                // Stage 4: Owner account has at least one pitch that is approved and awaiting going live.
                if (pitches.length === 1 && pitches.every(pitch => pitch.status === "APPROVED")) return "PUBLISHING_REQUIRED";
            
                // Stage 5(a): Owner account has at least one pitch that is approved and live.
                const activeStates = ["LIVE", "ARCHIVED"];
                if (pitches.some(pitch => activeStates.includes(pitch.status))) return "ACTIVE";
            
                // Stage 5(b): Owner account has at least one pitch but none are live.
                const inactiveStates = ["DELETED", "REJECTED", "SUSPENDED"];
                if (pitches.length >= 1 && pitches.every(pitch => inactiveStates.includes(pitch.status))) return "INACTIVE";
            
                // Stage 6: Fallback value/any weird edge cases.
                return "INACTIVE"
            }
    };
};

export const draftStepToIndex: Record<DraftStep, number> = {
    DETAILS: 0,
    SETTINGS: 1,
    LAYOUT: 2,
    SCHEDULE: 3
};

// Helper utility function to get the pitch draft step based on the draft data
export function getPitchDraftStep(draft: any) {
    let step = "DETAILS";

    if (draft.settings) step = "SETTINGS";
    if (draft.layout) step = "LAYOUT";
    if (draft.schedule && draft.schedule.length > 0) step = "SCHEDULE";

    return step as DraftStep;
};

export async function fetchAllPitches(id: string) {
    const user = await prisma.user.findFirst({ 
        where: { 
            id, 
            status: { notIn: ["SUSPENDED", "DELETED"] },
        },
        include: { 
            owner: { 
                include: { 
                    pitches: { 
                        select: {
                            id: true,
                            name: true,
                            status: true
                        }
                    }
                } 
            }, 
            manager: {
                include: {
                    pitches: {
                        select: {
                            id: true,
                            name: true,
                            status: true
                        }
                    }
                }
            } 
        } 
    });

    if (!user) throw new Error("Could not find user with the specified ID.");

    const ownerPitches = user.owner?.pitches.map(pitch => ({ ...pitch, role: "Owner" })) || [];
    const managerPitches = user.manager?.pitches.map(pitch => ({ ...pitch, role: "Manager" })) || [];

    const pitches = ownerPitches.concat(managerPitches);

    return pitches;
};

export async function fetchActivePitches(id: string) {
    const pitches = await fetchAllPitches(id);
    const inactiveStates = ["SUSPENDED", "DELETED", "REJECTED"];
    const updated = pitches.filter(pitch => !inactiveStates.includes(pitch.status));

    return updated;
}

export async function resolveUserRole(id: string): Promise<UserRole> {
    let role: UserRole = "USER";

    const user = await prisma.user.findUnique({ 
        where: { 
            id, 
            status: { notIn: ["SUSPENDED", "DELETED"] }
        },
        select: {
            owner: true,
            manager: true
        }
    });

    if (!user) throw new Error("Could not find user with the specified ID.");
    
    if (user.owner) role = "OWNER";
    if (user.manager) role = "MANAGER";

    return role;
}

// Schemas to validate the incoming step data against.
export const detailsSchema = z.object({
    name: z.string({ error: "Pitch name is required." })
        .min(4, "Pitch name must have at least 4 characters.")
        .max(100, "Pitch name must have 100 characters at most.")
        .transform(str => {
            return str[0].toUpperCase() + str.slice(1)
        }),
    taxId: z.string({ error: "Tax Identification Number (TIN) must be a string." })
        .transform((val) => (val === "" ? null : val))
        .nullable()
        .refine(
            (val) =>
            val === null ||
            /^(?:EG\s*)?\d{3}[-\s]?\d{3}[-\s]?\d{3}$/.test(val!),
            "Invalid Egyptian TIN (expected 9 digits)."
        ),
    basePrice: z.string("Base price is required.")
        .min(2, "This field is required.")
        .transform(Number)
        .refine((val) => val >= 50 && val <= 2000, {
            message: "Base price must be between 50 and 2000 EGP per hour.",
    }),
    amenities: z.array(z.enum(Object.values(Amenity)), { error: "Amenities must be an array of valid amenities." })
        .optional()
        .default([]),
    description: z.string({ error: "Pitch description is required." })
        .min(5, "Pitch description must have at least 5 characters.")
        .max(500, "Pitch description must have 500 characters at most."),
    street: z.string({ error: "Street address is required." })
        .min(4, "Street address must have at least 4 characters.")
        .max(100, "Street address must have 100 characters at most."),
    area: z.string({ error: "Area is required." })
        .min(2, "Area must have at least 2 characters.")
        .max(100, "Area must have 100 characters at most."),
    city: z.string({ error: "City is required." })
        .min(2, "City must have at least 2 characters.")
        .max(100, "City must have 100 characters at most."),
    country: z.enum(["EG", "SA", "AE"], { error: "A valid country code is required." }),
    latitude: z.string({ error: "Latitude is required." })
        .trim()
        .refine((val) => val === "" || /^-?\d+(\.\d+)?$/.test(val), "Invalid latitude format.")
        .transform((val) => (val === "" ? null : Number(val)))
        .nullable()
        .refine((val) => val === null || (val >= -90 && val <= 90), "Latitude must be between -90 and 90"),
    longitude: z.string({ error: "Longitude is required." })
        .trim()
        .refine((val) => val === "" || /^-?\d+(\.\d+)?$/.test(val), "Invalid longitude format.")
        .transform((val) => (val === "" ? null : Number(val)))
        .nullable()
        .refine((val) => val === null || (val >= -180 && val <= 180), "Longitude must be between -180 and 180"),
    googleMapsLink: z.string("Google Maps link is required.")
}).superRefine((data, ctx) => {
    let link = data.googleMapsLink?.trim();
    
    if (!link) {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message: "Google Maps link is required.",
        });
        return;
    }

    // Normalize (add protocol + www if missing)
    if (!/^https?:\/\//i.test(link)) link = "https://" + link;
    if (!/^https?:\/\/(www\.)?/i.test(link)) link = link.replace(/^https?:\/\//i, "https://www.");
    data.googleMapsLink = link;

    // Domain validation
    const isGoogleMaps = /https:\/\/(www\.)?google\.[a-z.]+\/maps\//i.test(link);
    const isShortLink = /https:\/\/(goo\.gl|maps\.app\.goo\.gl)\//i.test(link);

    if (!isGoogleMaps && !isShortLink) {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message: "Invalid Google Maps link format.",
        });
        return;
    }

    // Short links can't contain coordinates — reject
    if (isShortLink) {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message:
                "Short Google Maps sharing links (e.g. goo.gl or maps.app.goo.gl) can’t be used. Please open the link and copy the full URL from your browser’s address bar.",
        });
        return;
    }

    // Try to extract coordinates from all common formats
    const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,        // .../@30.0444,31.2357,17z
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,    // ...!3d30.0444!4d31.2357
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,   // ...?q=30.0444,31.2357
        /%40(-?\d+\.\d+),(-?\d+\.\d+)/,      // encoded @ e.g. %4030.0444,31.2357
    ];

    let lat: number | null = null;
    let lng: number | null = null;

    for (const pattern of patterns) {
        const match = link.match(pattern);
        if (match) {
            lat = parseFloat(match[1]);
            lng = parseFloat(match[2]);
            break;
        }
    }

    if (lat !== null && lng !== null) {
        if (data.latitude === null) data.latitude = lat;
        if (data.longitude === null) data.longitude = lng;
    } else {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message: "Could not extract coordinates. Please paste the full Google Maps URL (not a short sharing link).",
        });
    }
});

export const settingsSchema = z.object({
    automaticBookings: z.enum(["Yes", "No"], "Automatic booking setting is required.")
        .transform((val) => val === "Yes"),
    paymentDeadline: z.string()
        .transform(Number)
        .refine((val) => val >= 0 && val <= 24, {
            message: "Payment deadline must either be between 0 and 24 hours.",
        }),
    depositFee: z.string()
        .trim()
        .transform((val) => (val === "" ? null : Number(val)))
        .refine(
            (val) => val === null || (val >= 10 && val <= 50),
            "Deposit percentage must be between 10 and 50, or left empty."
        )
        .nullable(),
    minBookingHours: z.string("Minimum booking hours is required.")
        .transform(Number)
        .refine((val) => val >= 1 && val <= 4, {
            message: "Minimum booking hours must be between 1 and 4 hours.",
        }),
    maxBookingHours: z.string("Maximum booking hours is required.")
        .transform(Number)
        .refine((val) => val >= 2 && val <= 5, {
            message: "Maximum booking hours must be between 2 and 5 hours.",
        }),
    cancellationFee: z.string("Cancellation fee is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => val >= 0 && val <= 50, {
            message: "Cancellation fee must be between 0 and 50 percent.",
        }),
    cancellationGrace: z.string()
        .optional()
        .transform((val) => {
            if (val === undefined || val.trim() === "") return 1;
            return Number(val);
        })
        .refine((val) => !isNaN(val) && val >= 0, {
            message: "Invalid cancellation grace period.",
        }),
    noShowFee: z.string("No show fee is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => val >= 0 && val <= 100, {
            message: "No show fee must be between 0 and 100 percent.",
        }),
    advanceBooking: z.string("Advance booking hours is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => val >= 0 && val <= 23, {
            message: "Advance booking hours must be between 0 and 23 hours.",
        }),
    peakHourSurcharge: z.string("Peak hour surcharge is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => val >= 0 && val <= 50, {
            message: "Peak hour surcharge must be between 0 and 50 percent.",
        }),
    offPeakDiscount: z.string("Off peak discount is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => val >= 0 && val <= 50, {
            message: "Off peak discount must be between 0 and 50 percent.",
        }),
    payoutRate: z.enum(["BIWEEKLY", "MONTHLY"], "Payout rate is required."),
    payoutMethod: z.enum(["CREDIT_CARD", "WALLET", "CASH"], "Payout method is required.")
        .default("CASH")
        .optional(),
    paymentMethods: z.array(z.enum(["CREDIT_CARD", "WALLET", "CASH"], "Allowed payment method is required."))
        .min(1, "At least one method is required to allow users to book your pitch.")
        .max(3, "3 payment methods allowed at most.")
        .refine((arr) => new Set(arr).size === arr.length, "Payment methods must be unique.")
}).superRefine((data, ctx) => {
    if (data.minBookingHours > data.maxBookingHours) {
        ctx.addIssue({
            code: "custom",
            path: ["maxBookingHours"],
            message: "Maximum booking hours must be greater than minimum booking hours."
        });
    };

    if (data.cancellationGrace > data.advanceBooking) {
        ctx.addIssue({
            code: "custom",
            path: ["cancellationGrace"],
            message: "Cancellation grace period must be less than or equal to advance booking hours."
        });
    };

    if (data.advanceBooking >= data.paymentDeadline) {
        ctx.addIssue({
            code: "custom",
            path: ["paymentDeadline"],
            message: "Payment must happen before the hours before booking.",
        });
    }
});

const layoutSettingsSchema = z.object({
    minBookingHours: z
        .union([z.string(), z.null()])
        .transform((val) => (val === null ? null : Number(val)))
        .refine((val) => val === null || (val >= 1 && val <= 4), {
            message: "Minimum booking hours must be between 1 and 4 hours.",
        }),
    maxBookingHours: z
        .union([z.string(), z.null()])
        .transform((val) => (val === null ? null : Number(val)))
        .refine((val) => val === null || (val >= 2 && val <= 5), {
            message: "Maximum booking hours must be between 2 and 5 hours.",
        }),
    cancellationFee: z
        .union([z.string(), z.null()])
        .transform((val) => (val === null ? null : Number(val)))
        .refine((val) => val === null || (val >= 0 && val <= 50), {
            message: "Cancellation fee must be between 0 and 50 percent.",
        }),
    noShowFee: z
        .union([z.string(), z.null()])
        .transform((val) => (val === null ? null : Number(val)))
        .refine((val) => val === null || (val >= 0 && val <= 100), {
            message: "No show fee must be between 0 and 100 percent.",
        }),
    paymentDeadline: z
        .union([z.string(), z.null()])
        .transform((val) => (val === null ? null : Number(val)))
        .refine((val) => val === null || (val >= 0 && val <= 24), {
            message: "Payment deadline must be between 0 and 24 hours.",
        }),
    advanceBooking: z
        .union([z.string(), z.null()])
        .transform((val) => (val === null ? null : Number(val)))
        .refine((val) => val === null || (val >= 0 && val <= 23), {
            message: "Advance booking hours must be between 0 and 23 hours.",
        }),
    peakHourSurcharge: z
        .union([z.string(), z.null()])
        .transform((val) => (val === null ? null : Number(val)))
        .refine((val) => val === null || (val >= 0 && val <= 50), {
            message: "Peak hour surcharge must be between 0 and 50 percent.",
        }),
    offPeakDiscount: z
        .union([z.string(), z.null()])
        .transform((val) => (val === null ? null : Number(val)))
        .refine((val) => val === null || (val >= 0 && val <= 50), {
            message: "Off peak discount must be between 0 and 50 percent.",
        }),
})

export type LayoutTargetSettings = z.infer<typeof layoutSettingsSchema>;
export type LayoutPitchSettings = Pick<z.infer<typeof settingsSchema>, "advanceBooking" | "minBookingHours" | "maxBookingHours" | "cancellationFee" | "noShowFee" | "peakHourSurcharge" | "offPeakDiscount" | "paymentDeadline" | "cancellationGrace">;

export const layoutSchema = z.object({
  combinations: z.array(
    z.object({
        id: z.uuid("Combination ID must be a valid UUID."),
        name: z.string("A combination name is required.")
            .min(2, "Combination name must have at least 2 characters.")
            .max(100, "Combination name must have 100 characters at most.")
            .transform(str => {
                return str[0].toUpperCase() + str.slice(1)
            }),
        description: z.string()
            .max(500, "Additional description may not be longer than 500 characters.")
            .trim()
            .or(z.literal("").transform(() => null))
            .optional(),
        size: z.enum(Object.values(CombinationSize), "Combination size is required."),
        surfaceType: z.enum(Object.values(GroundSurfaceType), "Combination surface type is required."),
        grounds: z.array(z.uuid("Each ground ID must be a valid UUID."))
            .min(2, "A combination must consist of at least 2 grounds."),
        price: z.string("Combination price is required.")
            .min(2, "Price field is required.")
            .transform(Number)
            .refine((val) => val >= 100 && val <= 4000, {
                message: "Combination price must be between 100 and 4000 EGP per hour.",
            }),
        settings: layoutSettingsSchema
    })
  ),
  grounds: z.array(
    z.object({
        id: z.uuid("Ground ID must be a valid UUID."),
        name: z.string("Ground name is required.")
            .min(2, "Ground name must have at least 2 characters.")
            .max(100, "Ground name must have 100 characters at most.")
            .transform(str => {
                return str[0].toUpperCase() + str.slice(1)
            }),
        description: z.string()
            .max(500, "Additional description may not be longer than 500 characters.")
            .trim()
            .or(z.literal("").transform(() => null))
            .optional(),
        price: z.string("Ground price is required.")
            .min(2, "Price field is required.")
            .transform(Number)
            .refine((val) => val >= 50 && val <= 2000, {
                message: "Ground price must be between 50 and 2000 EGP per hour.",
            }),
        size: z.enum(Object.values(GroundSize), "Ground size is required."),
        surfaceType: z.enum(Object.values(GroundSurfaceType), "Ground surface type is required."),
        images: z.array(z.url("Each image must be a valid image URL.")),
        settings: layoutSettingsSchema
    })
  )
}).superRefine((data, ctx) => {
    // Make sure ground names are unique
    const groundNames = data.grounds.map(g => g.name.toLowerCase().trim());
    const duplicateGrounds = groundNames.filter(
        (name, idx) => groundNames.indexOf(name) !== idx
    );

    if (duplicateGrounds.length) {
        ctx.addIssue({
            code: "custom",
            path: ["grounds"],
            message: `Ground names must be unique. Duplicates: ${[...new Set(duplicateGrounds)].join(", ")}`
        });
    };

    // Make sure combination names are unique
    const combinationNames = data.combinations.map(c => c.name.toLowerCase().trim());
    const duplicateCombinations = combinationNames.filter(
        (name, idx) => combinationNames.indexOf(name) !== idx
    );

    if (duplicateCombinations.length) {
        ctx.addIssue({
            code: "custom",
            path: ["combinations"],
            message: `Combination names must be unique. Duplicates: ${[...new Set(duplicateCombinations)].join(", ")}`
        });
    }

    // Ground names and combination names must not overlap
    const crossDuplicates = groundNames.filter(n => combinationNames.includes(n));

    if (crossDuplicates.length) {
        ctx.addIssue({
            code: "custom",
            path: [], // root-level error
            message: `Ground and combination names must all be unique across both groups. Conflicts: ${[...new Set(crossDuplicates)].join(", ")}`
        });
    };

    // Make sure each combination’s grounds array has unique IDs
    data.combinations.forEach((c, i) => {
        const ids = c.grounds;
        const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);

        if (duplicates.length) {
            ctx.addIssue({
                code: "custom",
                path: ["combinations", i, "grounds"],
                message: `Ground IDs in a combination must be unique. Duplicates: ${[...new Set(duplicates)].join(", ")}`
            });
        }

        // Make sure that every single combination has only one surfaceType
        const combinationGrounds = data.grounds.filter(g => ids.includes(g.id));
        const surfaceTypes = [...new Set(combinationGrounds.map(g => g.surfaceType))];

        if (surfaceTypes.length > 1) {
            ctx.addIssue({
                code: "custom",
                path: ["combinations", i, "grounds"],
                message: `All grounds in combination "${c.name}" must have the same surface type. Found: ${surfaceTypes.join(", ")}`
            });
        }
    });
});

export const scheduleSchema = z.array(
    z.object({
        dayOfWeek: z.number("Day of the week must be included within the schedule object.")
            .int("Day of week must be a valid whole number.")
            .min(0, "Day of the week must be between 0 and 6.")
            .max(6, "Day of the week must be between 0 and 6."),
        openTime: z.number("Open time must be included within the schedule object.")
            .int("Open time must be a valid whole number.")
            .min(0, "Open time must be 0 at least.")
            .max(23, "Open time must be up to 23 at most."),
        closeTime: z.number("Close time must be included within the schedule object.")
            .int("Close time must be a valid whole number.")
            .min(0, "Close time must be 0 at least.")
            .max(24, "Close time must be up to 24 at most."),
        peakHours: z.array(
            z.number()
            .int("Peak hour must be a valid whole number.")
            .min(0, "Peak hour slot index must be 0 at least.")
            .max(24, "Peak hour slot index must be 24 at most.")
        ),
        offPeakHours: z.array(
            z.number()
            .int("Off peak hour must be a valid whole number.")
            .min(0, "Off peak hour slot index must be 0 at least.")
            .max(24, "Off peak hour slot index must be 24 at most.")
        )
    }), "Schedule must be an array of objects.")
.length(7, "Schedule must have rules for exactly 7 days.")
.superRefine((data, ctx) => {
    data.map(item => {
        const peakHours = item.peakHours;
        const offPeakHours = item.offPeakHours;

        const duplicates = peakHours.filter(slot => offPeakHours.includes(slot));

        if (duplicates.length) {
            ctx.addIssue({
                code: "custom",
                path: ["offPeakHours"],
                message: `Off peak hours must be unique. May not contain overlapping peak hours. Duplicates: ${[...new Set(duplicates)].join(", ")}`
            });
        };

        if (item.openTime === 0 && item.closeTime === 0) {
            if (peakHours.length > 0) {
                ctx.addIssue({
                    code: "custom",
                    path: ["peakHours"],
                    message: "Peak hours may not be included if the day is closed."
                })
            };
            
            if (offPeakHours.length > 0) {
                ctx.addIssue({
                    code: "custom",
                    path: ["offPeakHours"],
                    message: "Off peak hours may not be included if the day is closed."
                })
            };
        }
    })
});

export const layoutSizeMap = new Map<string, number>([
    ["FIVE", 1],
    ["SEVEN", 1.25],
    ["ELEVEN", 1.5]
]);

export const generateLayoutGrid = (grounds: Pick<GroundType, "id" | "name" | "surfaceType" | "size">[]) => {
    const grid = [];

    for (let i = 0; i < grounds.length; i++) {
        const ground = grounds[i];
        
        const item = {
            order: i + 1,
            isVertical: Math.random() < 0.5,
            id: ground.id,
            name: ground.name,
            surfaceType: ground.surfaceType,
            size: ground.size,
            scale: layoutSizeMap.get(ground.size)
        };

        grid.push(item);
    };

    return grid;
};

export interface TargetOption {
    name: string;
    id: string;
    type: "ALL" | "GROUND" | "COMBINATION"
};

export type BookingTargetOption = TargetOption;

export const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");

    if (!local || !domain) return email;
    if (local.length <= 2) {
        return `${local}*****@${domain}`;
    }

    const firstChar = local[0];
    const lastChar = local[local.length - 1];

    return `${firstChar}*****${lastChar}@${domain}`;
};

export type IntervalType = "ONE_WEEK" | "TWO_WEEK" | "THREE_WEEK" | "ONE_MONTH" | "TWO_MONTH";
export type PaymentType = "ONE_TIME" | "PER_INSTANCE";

export interface RecurringOptions {
    frequency: "WEEKLY" | "MONTHLY",
    interval: IntervalType,
    occurrences: number,
    endsAt: Date,
    payment: PaymentType
};

export interface CreateBookingPayload {
    bookingId: string;
    startedAt: Date;
    target: string;
    targetType: "GROUND" | "COMBINATION";
    startDate: Date;
    timeslots: Array<{
        startTime: Date,
        endTime: Date
    }>;
    firstName: string;
    lastName: string;
    phone: string;
    source: BookingSource;
    paymentMethod: BillingMethod | null;
    notes: string;
    recurringOptions: RecurringOptions | null;
};

export const calculateAvailableHours = (schedules: PitchSchedule[]) => {
    if (!schedules.length) return 0;

    let hours = 0;

    schedules.map(schedule => {
        if (schedule.openTime === 0 && schedule.closeTime === 0) return;
        hours += schedule.closeTime - schedule.openTime;
    });

    return hours;
};

export async function calculatePeriodAnalytics(
    pitchId: string,
    startDate: Date,
    endDate: Date,
    schedule: any[]
) {
    const bookings = await prisma.booking.findMany({ 
        where: {
            pitchId,
            startDate: { gte: startDate, lte: endDate }
        },
        include: {
            grounds: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    const totalBookings = bookings.length;
    const totalAvailability = calculateAvailableHours(schedule);

    const seenCustomers = new Set<string>();
    const recurringCustomers = new Set<string>();

    bookings.forEach(booking => {
        const customerId = booking.userId || booking.guestId;
        if (!customerId) return;

        if (seenCustomers.has(customerId)) {
            recurringCustomers.add(customerId);
        } else {
            seenCustomers.add(customerId);
        }
    });

    const totalCustomers = seenCustomers.size;
    const recurringCount = recurringCustomers.size;

    const confirmedBookings = bookings.filter(b => 
        ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'].includes(b.status)
    );

    const cancelledBookings = bookings.filter(b => b.status === 'CANCELLED');
    const noShowBookings = bookings.filter(b => b.status === 'NO_SHOW');

    const totalRevenue = bookings
        .filter(b => ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'].includes(b.status))
        .reduce((sum, b) => sum + b.totalPrice, 0);

    const bookedHours = bookings
        .filter(b => ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'].includes(b.status))
        .reduce((sum, booking) => {
            const hours = differenceInHours(booking.endDate, booking.startDate);
            return sum + (hours * booking.grounds.length);
        }, 0);

    return {
        totalBookings,
        totalRevenue,
        totalCustomers,
        recurringCount,
        bookedHours,
        totalAvailability,
        cancelledCount: cancelledBookings.length,
        noShowCount: noShowBookings.length,
        confirmedCount: confirmedBookings.length,
        bookings
    };
}

export function calculateChange(current: number, previous: number): {
    value: number;
    percentage: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
} {
    if (previous === 0) {
        return {
            value: current,
            percentage: current > 0 ? 100 : 0,
            direction: current > 0 ? 'UP' : 'NEUTRAL'
        };
    }

    const percentage = ((current - previous) / previous) * 100;
    
    return {
        value: current,
        percentage: Math.abs(percentage),
        direction: percentage > 0 ? 'UP' : percentage < 0 ? 'DOWN' : 'NEUTRAL'
    };
};
