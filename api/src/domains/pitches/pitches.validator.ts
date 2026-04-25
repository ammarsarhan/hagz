import z from "zod";
import { Country, GroundSize, GroundSport, GroundSurface, PermissionsRole } from "@/generated/prisma/enums.js";

export interface PitchPermissionsType {
    pitchId: string;
    permissions: any | null;
    role: PermissionsRole;
}

export type CreatePitchPayloadType = z.infer<typeof createPitchSchema>;

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

export const createPitchSchema = z.object({
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
})
.transform((data, ctx) => {
    const coords = extractCoordinates(data.googleMapsLink);

    if (!coords) {
        ctx.addIssue({ code: "custom", path: ["googleMapsLink"], message: "Could not extract coordinates from this link." });
        return z.NEVER;
    };

    return { ...data, ...coords };
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
