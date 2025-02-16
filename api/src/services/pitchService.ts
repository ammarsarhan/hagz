import * as z from 'zod';
import { createPitch, getPitch } from '../repositories/pitchRepository';
import { PitchCreateRequestType } from '../types/pitch';


export async function createPitchWithDetails({ name, description, owner, coordinates, size, surface, amenities, images, price, policy, minimumSession, maximumSession } : PitchCreateRequestType) {
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
            price: z.number().nonnegative("Price may not be a negative number."),
            policy: z.enum(["DEFAULT", "EXTENDED", "SHORT"], { message: "Policy must be one of available options." }),
            minimumSession: z.number().min(1).max(2),
            maximumSession: z.number().min(2).max(6)
        }).refine(data => data.minimumSession < data.maximumSession, {
            message: "Minimum reservation duration cannot be larger than maximum reservation duration.",
            path: ["maximumSession"]
        })

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
            policy: policy,
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

export async function fetchPitchById(id: string) {
    try {
        const pitch = await getPitch(id);
        return pitch;
    } catch (error: any) {
        throw new Error(error.message);
    }
}