import { Request, Response } from "express";
import { createPitch, fetchInitialPitches, fetchPitchesWithCursor, getPitch } from "../repositories/pitchRepository";
import { z } from "zod";
import { Ground, GroundSize, GroundSurface, PitchAmenity } from "@prisma/client";

export async function handleCreatePitch(req: Request, res: Response) {
    try {
        const options = req.body;
        const { name, description, longitude, latitude, amenities, images, settings, location, minimumSession, maximumSession, openFrom, openTo } = options;

        if (!name || !description || !longitude || !latitude || !amenities || !images || !settings || !location || !minimumSession || !maximumSession) {
            throw new Error("Please make sure all of the required fields are not empty.");
        };

        const schema = z.object({
            name: z.string().min(5, { message: "Pitch name must include at least 5 characters." }).max(50, { message: "Pitch name must be limited to 50 characters at most." }),
            description: z.string(),
            owner: z.string().min(1, { message: "Owner ID cannot be empty." }),
            longitude: z.number().min(-180, { message: "Longitude cannot be smaller than -180." }).max(180, { message: "Longitude cannot be larger than 180." }),
            latitude: z.number().min(-90, { message: "Latitude cannot be smaller than -90." }).max(90, { message: "Latitude cannot be larger than 90." }),
            amenities: z.array(z.enum(["INDOORS", "BALL_PROVIDED", "SEATING", "NIGHT_LIGHTS", "PARKING", "SHOWERS", "CHANGING_ROOMS", "CAFETERIA", "FIRST_AID", "SECURITY"], { message: "Selected amenity must be one of available options." })),
            images: z.array(z.string().url({ message: "Images must be a list of valid URLs." }), { message: "Images must be a list of valid URLs." }),
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
            openFrom: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format for openFrom field. Use HH:mm"),
            openTo: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format for openTo field. Use HH:mm")
        }).refine(data => data.minimumSession <= data.maximumSession, {
            message: "Minimum reservation duration cannot be larger than maximum reservation duration.",
            path: ["maximumSession"]
        });

        const parsed = schema.safeParse({ ...options, owner: req.user.id });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        };

        const pitch = await createPitch({ ...parsed.data, ownerId: req.user.id });
        
        res.status(200).json({ success: true, data: pitch });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export async function handleGetPitch(req: Request, res: Response) {
    try {
        const id = req.params.pitch;
        const pitch = await getPitch(id);

        res.status(200).json({ success: true, data: pitch });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export async function handleFetchPitches(req: Request, res: Response) {
    try {
        const { limit, cursor, startDate, endDate, min, max, longitude, latitude, radius, size, surface, amenities } = req.query;

        let groundSize: GroundSize[] = [];
        let groundSurface: GroundSurface[] = [];
        let amenitiesList: PitchAmenity[] = [];

        if (!limit) {
            throw new Error("Invalid request. Query limit was not provided in request.")
        };

        const schema = z.object({
            limit: z.number({ message: "Please provide a valid integer for the query." }).nonnegative("Query limit may not be negative.").min(2, { message: "Query limit must be 5 at minimum." }).max(10, { message: "Query limit must be 10 at most." }),
            cursor: z.string().datetime("Invalid query cursor provided. Please provide a valid timestamp.").optional(),
            startDate: z.string().datetime("Invalid query start date provided. Please provide a valid timestamp.").optional(),
            endDate: z.string().datetime("Invalid query end date provided. Please provide a valid timestamp.").optional(),
            minimumPrice: z.number().nonnegative("Minimum price may not be a negative number.").min(100, { message: "Minimum price must be 100 EGP at least." }).max(900, { message: "Minimum price must be 900 EGP at most." }),
            maximumPrice: z.number().nonnegative("Maximum price may not be a negative number.").min(200, { message: "Maximum price must be 200 EGP at least." }).max(1000, { message: "Maximum price must be 1000 EGP at most." }),
            target: z.object({
                longitude: z.number({ message: "Please provide a valid value for longitude." }).min(-180, { message: "Longitude cannot be smaller than -180." }).max(180, { message: "Longitude cannot be larger than 180." }).optional(),
                latitude: z.number({ message: "Please provide a valid value for latitude." }).min(-90, { message: "Latitude cannot be smaller than -90." }).max(90, { message: "Latitude cannot be larger than 90." }).optional(),
            }),
            radius: z.number().nonnegative("Search radius may not be a negative number.").min(1, { message: "Search radius must be 1 at minimum." }).max(10, { message: "Search radius must be 10 at most." }).optional(),
            size: z.array(z.enum(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"]), { message: "Selected ground size must be one of available options." }).default(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"]),
            surface: z.array(z.enum(["NATURAL", "ARTIFICIAL"]), { message: "Selected ground type must be one of available options." }).default(["NATURAL", "ARTIFICIAL"]),
            amenities: z.array(z.enum(["INDOORS", "BALL_PROVIDED", "SEATING", "NIGHT_LIGHTS", "PARKING", "SHOWERS", "CHANGING_ROOMS", "CAFETERIA", "FIRST_AID", "SECURITY"], { message: "Selected amenity must be one of available options." })).default([])
        })
        .refine(data => {
            if (data.radius !== undefined) {
                return data.target !== undefined;
            }
            return true;
        }, { message: "If a search radius is provided, both longitude and latitude must be provided." })
        .refine(data => {
            if ((data.startDate && !data.endDate) || (!data.startDate && data.endDate)) {
                return false;
            }
            return true;
        }, { message: "If start date is provided, end date must also be provided, and vice versa." })
        .refine(data => {
            if ((data.minimumPrice !== undefined && data.maximumPrice === undefined) || (data.minimumPrice === undefined && data.maximumPrice !== undefined)) {
                return false;
            }
            return true;
        }, { message: "If minimum price is provided, maximum price must also be provided, and vice versa." })
        .refine(data => {
            if (data.startDate && data.endDate) {
                const start = new Date(data.startDate).getTime();
                const end = new Date(data.endDate).getTime();

                return !isNaN(start) && !isNaN(end) && start < end;
            };
            
            return true;
        }, { message: "If start date and end date are provided, start date must be before end date." })
        .refine(data => {
            if (data.minimumPrice && data.maximumPrice) {
                return data.minimumPrice < data.maximumPrice;
            };

            return true;
        }, { message: "If minimum price and maximum price are provided, minimum price must be less than maximum price." });

        if (size && !Array.isArray(size)) {
            groundSize.push(size as GroundSize);
        } else if (size && size.length > 1) {
            groundSize = size as GroundSize[];
        };

        if (surface && !Array.isArray(surface)) {
            groundSurface.push(surface as GroundSurface);
        } else if (surface && surface.length > 1) {
            groundSurface = surface as GroundSurface[];
        };

        if (amenities && !Array.isArray(amenities)) {
            amenitiesList.push(amenities as PitchAmenity);
        } else if (amenities && amenities.length > 1) {
            amenitiesList = amenities as PitchAmenity[];
        };
        
        const parsed = schema.safeParse({
            limit: limit ? parseInt(limit as string) : 10,
            cursor: cursor,
            startDate,
            endDate,
            minimumPrice: min !== undefined && min !== "" ? parseFloat(min as string) : 100,
            maximumPrice: max !== undefined && max !== "" ? parseFloat(max as string) : 1000,
            target: {
                longitude: Number(longitude) || undefined,
                latitude: Number(latitude) || undefined
            },
            radius: Number(radius) || undefined,
            size: groundSize,
            surface: groundSurface,
            amenities: amenitiesList
        });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        };

        const options = parsed.data;

        if (options.limit && !options.cursor) {
            const pitches = await fetchInitialPitches(options.limit, { 
                startDate: options.startDate || null, 
                endDate: options.endDate || null, 
                minimumPrice: options.minimumPrice, 
                maximumPrice: options.maximumPrice, 
                target: {
                    longitude: options.target.longitude || null,
                    latitude: options.target.latitude || null
                },
                radius: options.radius || null, 
                size: options.size, 
                surface: options.surface, 
                amenities: options.amenities 
            });
            
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
            const pitches = await fetchPitchesWithCursor(options.limit, options.cursor, { 
                startDate: options.startDate || null, 
                endDate: options.endDate || null, 
                minimumPrice: options.minimumPrice, 
                maximumPrice: options.maximumPrice, 
                target: {
                    longitude: options.target.longitude || null,
                    latitude: options.target.latitude || null
                },
                radius: options.radius || null, 
                size: options.size, 
                surface: options.surface, 
                amenities: options.amenities 
            });

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
};