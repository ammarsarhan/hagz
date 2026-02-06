import z from "zod";
import { amenities } from "@/app/utils/types/dashboard";

export const pitchDetailsSchema = z.object({
    name: z
        .string("Pitch name is required.")
        .min(2, "Pitch name must be at least 2 characters long.")
        .max(100, "Pitch name may not be longer than 100 characters."),
    description: z
        .string("Pitch description is required.")
        .min(5, "Pitch description must be at least 5 characters long.")
        .max(1000, "Pitch description may not be longer than 1000 characters."),
    taxId: z
        .string("Tax Identification Number (TIN) is required for proper verification")
        .regex(/^\d{3}-\d{3}-\d{3}$/, "TIN must be in the format 123-456-789"),
    images: 
        z.array(z.any())
        .min(3, "At least 3 images are required.")
        .max(10, "You may upload up to 10 images per pitch."),
    googleMapsLink: z.string("Google Maps link is required.")
}).superRefine((data, ctx) => {
    let link = data.googleMapsLink.trim();

    if (!/^https?:\/\//i.test(link)) link = "https://" + link;
    if (!/^https?:\/\/(www\.)?/i.test(link)) link = link.replace(/^https?:\/\//i, "https://www.");
    data.googleMapsLink = link;

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

    if (isShortLink) {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message:
                "Short Google Maps sharing links (e.g. goo.gl or maps.app.goo.gl) can’t be used. Please open the link and copy the full URL from your browser’s address bar.",
        });
        return;
    }

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
        console.log(lat, lng)
    } else {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message: "Could not extract coordinates. Please paste the full Google Maps URL (not a short sharing link).",
        });
    }
});

export const createAmenitySchema = z.object({ 
    name: z.enum(Object.values(amenities)),
    description: z
        .string()
        .min(2, "Amenity description must be at least 2 characters long.")
        .max(100, "Amenity description may not be longer than 100 characters.")
        .optional()
        .or(z.literal("")),
    isPaid: z.boolean(),
    price: z
        .string()
        .optional()
        .transform((val) => val === "" ? undefined : Number(val))
        .refine((val) => val === undefined || (val >= 10 && val <= 200), {
            message: "Amenity price must be between 10 and 200 EGP per hour.",
        }),
});