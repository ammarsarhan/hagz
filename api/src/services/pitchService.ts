import { z } from 'zod';
import { createPitch, getPitch, getInitialPitches, getPitchesByCursor, queryByLocation, updateField, searchPitches } from '../repositories/pitchRepository';
import { PitchCreateRequestType } from '../types/pitch';

export async function createPitchWithDetails({ name, description, owner, coordinates, size, surface, amenities, images, price, settings, location, minimumSession, maximumSession } : PitchCreateRequestType) {
    try {
        const schema = z.object({
            name: z.string().min(5, { message: "Pitch name must include at least 5 characters." }).max(50, { message: "Pitch name must be limited to 50 characters at most." }),
            description: z.string(),
            owner: z.string().min(1, { message: "Owner ID cannot be empty." }),
            longitude: z.number().min(-180, { message: "Longitude cannot be smaller than -180." }).max(180, { message: "Longitude cannot be larger than 180." }),
            latitude: z.number().min(-90, { message: "Latitude cannot be smaller than -90." }).max(90, { message: "Latitude cannot be larger than 90." }),
            size: z.enum(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"], { message: "Selected pitch size must be one of available options." }),
            surface: z.enum(["GRASS", "ARTIFICIAL"], { message: "Selected ground type must be one of available options." }),
            amenities: z.array(z.enum(["INDOORS", "BALL_PROVIDED", "SEATING", "NIGHT_LIGHTS", "PARKING", "SHOWERS", "CHANGING_ROOMS", "CAFETERIA", "FIRST_AID", "SECURITY"], { message: "Selected amenity must be one of available options." })),
            images: z.array(z.string().url({ message: "Images must be a list of valid URLs." }), { message: "Images must be a list of valid URLs." }),
            price: z.number().nonnegative("Hourly rate may not be a negative number.").min(100, { message: "Hourly rate must be 100 EGP at least." }).max(1000, { message: "Hourly rate must be 1000 EGP at most." }),
            settings: z.object({
                automaticApproval: z.boolean({ message: "Automatic approval must be a boolean value." }).default(true),
                paymentPolicy: z.enum(["SHORT", "DEFAULT", "EXTENDED"], { message: "Payment policy must be one of available options." }),
                refundPolicy: z.enum(["PARTIAL", "FULL"], { message: "Refund policy must be one of available options." }),
            }, { message: "Settings must be an object with all required properties." }),
            location: z.object({
                street: z.string({ message: "Street name must be a valid string." }).min(5, { message: "Street name must include at least 5 characters." }),
                district: z.string({ message: "District name must be a valid string." }).min(5, { message: "District name must include at least 5 characters." }),
                city: z.string({ message: "City name must be a valid string." }).min(5, { message: "City name must include at least 5 characters." }),
                governorate: z.string({ message: "Governorate name must be a valid string." }).min(5, { message: "Governorate name must include at least 5 characters." }),
                country: z.string({ message: "Country name must be a valid string." }).min(5, { message: "Country name must include at least 5 characters." }),
                postalCode: z.number({ message: "Postal code must be a valid number." }).int({ message: "Postal code must be a valid integer." }).min(1000, { message: "Postal code must be at least 4 digits." }).max(9999, { message: "Postal code must be at most 4 digits." }).optional(),
                externalLink: z.string({ message: "Google Maps link must be a valid URL." }).url({ message: "Google Maps link must be a valid URL." }).regex(/^(https?:\/\/)?(www\.)?(google\.com\/maps|goo\.gl\/maps)\/[^\s]+$/, "Please enter a valid Google Maps link.").optional()
            }),
            minimumSession: z.number().min(1).max(2).default(1),
            maximumSession: z.number().min(2).max(6).default(6)
        }).refine(data => data.minimumSession <= data.maximumSession, {
            message: "Minimum reservation duration cannot be larger than maximum reservation duration.",
            path: ["maximumSession"]
        });

        const parsed = schema.safeParse({
            name: name,
            description: description,
            owner: owner,
            longitude: coordinates.longitude,
            latitude: coordinates.latitude,
            size: size,
            surface: surface,
            amenities: amenities,
            images: images,
            price: price,
            settings: settings,
            location: location,
            minimumSession: minimumSession,
            maximumSession: maximumSession
        });
    
        if (parsed.error) {
            throw new Error(parsed.error.errors[0].message);
        }

        const id = await createPitch({...parsed.data, coordinates: { longitude: parsed.data.longitude, latitude: parsed.data.latitude }});
        return id;
    } catch (error: any) {
        throw new Error(error.message);
    } 
}

export async function getPitchesWithinRadius(longitude: number, latitude: number, radius: number) {
    const dp = (value: number) => {
        return value.toString().match(/^-?\d+\.\d{4,}$/) !== null;
    };

    try {
        const schema = z.object({
            longitude: z.number({ message: "Please provide a valid longitude." }).min(-180, "Longitude must be within -180 and 180.").max(180, "Longitude must be within -180 and 180.").refine(dp, { message: "Longitude must have at least 4 decimal places." }),
            latitude: z.number({ message: "Please provide a valid latitude." }).min(-90, "Latitude must be within -90 and 90.").max(90, "Latitude must be within -90 and 90.").refine(dp, { message: "Longitude must have at least 4 decimal places." }),
            radius: z.number({ message: "Please provide a valid radius." }).min(1, "Radius must be within 1 and 10.").max(10, "Radius must be within 1 and 10.")
        })
        
        const parsed = schema.safeParse({ longitude, latitude, radius });
        
        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const pitches = await queryByLocation(longitude, latitude, radius);
        return pitches;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getPaginatedPitches(id: string, limit: number) {
    try {
        const schema = z.object({
            cursor: z.string({ message: "Please provide a valid timestamp to fetch pitches." }).datetime({ message: "Invalid timestamp provided for cursor. Please provide a valid timestamp." }).optional(),
            limit: z.number({ message: "Please provide a valid limit to fetch pitches." }).int("Number must be a valid integer.").min(1, { message: "Limit must at least be 1." }).max(10, { message: "Limit must at most be 10." }).nonnegative("Limit must be a non-negative number.")
        })

        const parsed = schema.safeParse({ cursor: id, limit });

        if (!parsed.success) {
            throw new Error("Failed to fetch pitches. " + parsed.error.errors[0].message);
        }

        if (!parsed.data.cursor) {
            const pitches = await getInitialPitches(parsed.data.limit);
            const cursor = pitches.length > 0 ? pitches[pitches.length - 1].updatedAt : null;
    
            return {
                pitches: pitches,
                cursor: cursor
            };
        }
    
        const pitches = await getPitchesByCursor(parsed.data.cursor, parsed.data.limit);
        const cursor = pitches.length > 0 ? pitches[pitches.length - 1].updatedAt : null;

        return {
            pitches: pitches,
            cursor: cursor,
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function fetchPitchById(id: string) {
    try {
        const idSchema = z.string({ message: "No string provided to fetch pitch." }).cuid({ message: "Invalid CUID provided for search. Please provide a valid pitch ID." });
        const parsed = idSchema.safeParse(id);

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        const pitch = await getPitch(parsed.data);
        return pitch;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function updatePitchField(id: string, field: string, value: string) {
    try {
        const mapping: Record<string, string> = {
            "minimum-session": "minimumSession",
            "maximum-session": "maximumSession",
        }

        field = mapping[field] || field;

        const fields = ["name", "description", "longitude", "latitude", "size", "surface", "status", "amenities", "images", "price", "settings", "minimumSession", "maximumSession"];
        const numericFields = ["longitude", "latitude", "price", "minimumSession", "maximumSession"];

        let formattedValue: string | number = value;
    
        const inputSchema = z.object({
            id: z.string({ message: "Please provide a valid pitch ID." }).cuid("Please provide a valid pitch ID to update the following property."),
            field: z.enum(fields as [string, ...string[]], { message: "Please provide a valid pitch update field." })
        })
    
        const parsed = inputSchema.safeParse({ id, field });
    
        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        }

        if (numericFields.includes(parsed.data.field)) {
            formattedValue = Number(formattedValue);

            if (isNaN(formattedValue)) {
                throw new Error(`Please provide a valid number for the field: ${field}.`)
            }
        }

        const dp = (value: number) => {
            return value.toString().match(/^-?\d+\.\d{4,}$/) !== null;
        };

        const pitchSchema = z.object({
            name: z.string().min(5, { message: "Pitch name must include at least 5 characters." }).max(50, { message: "Pitch name must be limited to 50 characters at most." }),
            description: z.string(),
            owner: z.string().min(1, { message: "Owner ID cannot be empty." }),
            longitude: z.number().min(-180, { message: "Longitude cannot be smaller than -180." }).max(180, { message: "Longitude cannot be larger than 180." }).refine(dp, { message: "Longitude must have at least 4 decimal places." }),
            latitude: z.number().min(-90, { message: "Latitude cannot be smaller than -90." }).max(90, { message: "Latitude cannot be larger than 90." }).refine(dp, { message: "Latitude must have at least 4 decimal places." }),
            status: z.enum(["ACTIVE", "MAINTENANCE", "CLOSED"], { message: "Selected pitch status must be one of available options." }),
            size: z.enum(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"], { message: "Selected pitch size must be one of available options." }),
            surface: z.enum(["GRASS", "ARTIFICIAL"], { message: "Selected ground type must be one of available options." }),
            amenities: z.array(z.enum(["INDOORS", "BALL_PROVIDED", "SEATING", "NIGHT_LIGHTS", "PARKING", "SHOWERS", "CHANGING_ROOMS", "CAFETERIA", "FIRST_AID", "SECURITY"], { message: "Selected amenity must be one of available options." })),
            images: z.array(z.string().url({ message: "Images must be a list of valid URLs." }), { message: "Images must be a list of valid URLs." }),
            price: z.number().nonnegative("Hourly rate may not be a negative number.").min(100, { message: "Hourly rate must be 100 EGP at least." }).max(1000, { message: "Hourly rate must be 1000 EGP at most." }),
            settings: z.object({
                automaticApproval: z.boolean({ message: "Automatic approval must be provided as either true or false." }),
                paymentPolicy: z.enum(["SHORT", "DEFAULT", "EXTENDED"], { message: "Payment policy must be one of available options." }),
                refundPolicy: z.enum(["DEFAULT", "EXTENDED", "SHORT", "FULL"], { message: "Refund policy must be one of available options." }),
            }, { message: "Settings must be an object with all required properties." }),
            minimumSession: z.number().min(1).max(2),
            maximumSession: z.number().min(2).max(6)
        })

        type PitchSchemaShapeType = typeof pitchSchema.shape;
        const fieldSchema = pitchSchema.shape[parsed.data.field as keyof PitchSchemaShapeType];

        if (!fieldSchema) {
            throw new Error(`Invalid field provided: ${field}`);
        }

        const parsedValue = fieldSchema.safeParse(formattedValue);

        if (!parsedValue.success) {
            throw new Error(parsedValue.error.errors[0].message);
        }

        const updated = await updateField(id, field, parsedValue.data);
        return updated;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function searchForPitches(keywords: string) {  
    const schema = z.string().min(1, { message: "Please provide at least one character to search for pitches." }).max(100, { message: "Search query may be up to 100 characters at most." });
    const parsed = schema.safeParse(keywords);

    if (!parsed.success) {
        throw new Error(`Failed to search for pitch with specified keywords: ${parsed.error.errors[0].message}`);
    }

    const formatted = parsed.data.trim().split(/\s+/).map((word) => `${word}:*`).join(" & ");

    const results = await searchPitches(formatted);
    return results;
}