import { Request, Response } from "express";
import { createPitch, fetchInitialPitches, fetchPitchesWithCursor, getPitch } from "../repositories/pitchRepository";
import { createGround } from "../repositories/groundRepository";
import { z } from "zod";

export async function handleCreatePitch(req: Request, res: Response) {
    try {
        const options = req.body;
        const { name, description, longitude, latitude, amenities, images, price, settings, location, minimumSession, maximumSession, size, surface } = options;

        if (!name || !description || !longitude || !latitude || !amenities || !images || !price || !settings || !location || !minimumSession || !maximumSession) {
            throw new Error("Please make sure all of the required fields are not empty.");
        }

        const schema = z.object({
            name: z.string().min(5, { message: "Pitch name must include at least 5 characters." }).max(50, { message: "Pitch name must be limited to 50 characters at most." }),
            description: z.string(),
            owner: z.string().min(1, { message: "Owner ID cannot be empty." }),
            longitude: z.number().min(-180, { message: "Longitude cannot be smaller than -180." }).max(180, { message: "Longitude cannot be larger than 180." }),
            latitude: z.number().min(-90, { message: "Latitude cannot be smaller than -90." }).max(90, { message: "Latitude cannot be larger than 90." }),
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
            maximumSession: z.number().min(2).max(6).default(6),
            size: z.enum(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"], { message: "Selected pitch size must be one of available options." }),
            surface: z.enum(["GRASS", "ARTIFICIAL"], { message: "Selected ground type must be one of available options." }),
            groundImages: z.array(z.string().url({ message: "Ground images must be a list of valid URLs." }), { message: "Ground images must be a list of valid URLs." })
        }).refine(data => data.minimumSession <= data.maximumSession, {
            message: "Minimum reservation duration cannot be larger than maximum reservation duration.",
            path: ["maximumSession"]
        });

        const parsed = schema.safeParse({ ...options, owner: req.user.id });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        };

        const pitch = await createPitch({ ...parsed.data, ownerId: req.user.id });
        const ground = await createGround({ pitchId: pitch.id, images: parsed.data.groundImages, size, surface });
        
        res.status(200).json({ success: true, data: {
            pitch,
            ground
        }});
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleGetPitch(req: Request, res: Response) {
    try {
        const id = req.params.pitch;
        const pitch = await getPitch(id);
        res.status(200).json({ success: true, data: pitch });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleFetchPitches(req: Request, res: Response) {
    try {
        const { limit, cursor } = req.query;

        if (!limit) {
            throw new Error("Invalid request. Query limit was not provided in request.")
        }

        const schema = z.object({
            limit: z.number({ message: "Please provide a valid integer for the query." }).nonnegative("Query limit may not be negative.").min(5, { message: "Query limit must be 5 at minimum." }).max(10, { message: "Query limit must be 10 at most." }),
            cursor: z.string().datetime("Invalid query cursor provided. Please provide a valid timestamp.").optional()
        })

        const parsed = schema.safeParse({
            limit: Number(limit),
            cursor: cursor
        });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        };

        const options = parsed.data;

        if (options.limit && !options.cursor) {
            const pitches = await fetchInitialPitches(options.limit);
            const lastIndex = pitches.length - 1
            
            if (pitches.length < 1) {
                res.status(200).json({ success: true, data: { pitches: [], cursor: null }});
                return;
            }

            const data = {
                pitches: pitches,
                cursor: new Date(pitches[lastIndex].updatedAt)
            }

            res.status(200).json({ success: true, data: data });
            return;
        }

        if (options.limit && options.cursor) {
            const pitches = await fetchPitchesWithCursor(options.limit, options.cursor);
            const lastIndex = pitches.length - 1;

            if (pitches.length < 1) {
                res.status(200).json({ success: true, data: { pitches: [], cursor: null }});
                return;
            }
            
            const data = {
                pitches: pitches,
                cursor: new Date(pitches[lastIndex].updatedAt)
            };

            res.status(200).json({ success: true, data: data });
            return;
        }
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message })
    }
}