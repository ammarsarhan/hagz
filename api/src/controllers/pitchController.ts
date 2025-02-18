import { Request, Response } from "express";
import { createPitchWithDetails, fetchPitchById, getPitchesByCursor, getPitchesWithinRadius } from "../services/pitchService";
import * as z from 'zod';

export async function handleQueryPitches(req: Request, res: Response) {
    try {
        const params = req.query;
    
        if (!(params.longitude && params.latitude && params.radius) && !params.cursor) {
            throw new Error("Please provide a valid cursor or pin & radius combination.")
        }
     
        if (params.longitude && params.latitude && params.radius) {
            const lng = Number(params.longitude);
            const lat = Number(params.latitude);

            const radius = Number(params.radius) || 1;
                        
            const pitches = await getPitchesWithinRadius(lng, lat, radius);
            res.status(200).json({ success: true, message: "Fetched all pitches within specified radius.", data: pitches });
            return;
        }
    
        if (params.cursor) {
            const cursor = params.cursor;
            const limit = 5;

            const schema = z.object({
                cursor: z.string().uuid("Invalid UUID provided for cursor. Please provide a valid pitch ID.")
            })

            const parsed = schema.safeParse({ cursor })
    
            if (!parsed.success) {
                throw new Error(parsed.error.errors[0].message);
            }

            const pitches = await getPitchesByCursor(parsed.data.cursor, limit);
            res.status(200).json({ success: true, message: "Fetched pitches for specified cursor index.", data: pitches });
            return;
        }

        throw new Error("Please provide a valid pin and radius/cursor and limit combination.")
    } catch (error: any) {
        res.status(400).json({ success: false, message: `Failed to fetch pitch data. ${error.message}` });
    }
}

export async function handleSearchPitches(req: Request, res: Response) {
    try {
        const query = req.query.keywords;

        if (!query) {
            throw new Error("Please provide valid keywords to search for pitches.")
        }

        res.send("Handle full text search from here on out.")
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message })
    }
}

export async function handleFetchPitch(req: Request, res: Response) {
    try {
        const id = req.params.id;
    
        if (!id) {
            throw new Error("Please provide a valid pitch id to fetch data.")
        }
    
        const pitch = await fetchPitchById(id);
        res.status(200).json({success: true, message: "Fetched pitch data successfully!", data: pitch });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleUpdatePitch(req: Request, res: Response) {

}

export async function handleCreatePitchRequest(req: Request, res: Response) {
    try {
        const ownerId = req.user.id;

        if (!ownerId) {
            throw new Error("No Owner ID provided within the request. Owner ID is required to create a pitch.");
        }

        if (!req.body.name || !req.body.description || !req.body.longitude || !req.body.latitude || !req.body.size || !req.body.surface || !req.body.price || !req.body.policy || !req.body.minimumSession || !req.body.maximumSession) {
            throw new Error("Please provide all required parameters.")
        }

        const longitude = parseFloat(req.body.longitude);
        const latitude = parseFloat(req.body.latitude);
        const price = parseFloat(req.body.price);
        const minimumSession = parseInt(req.body.minimumSession);
        const maximumSession = parseInt(req.body.maximumSession);

        if (!longitude || !latitude || !price || !minimumSession || !maximumSession) {
            throw new Error("Please provide valid numbers for the required parameters.")
        }

        const data = {
            name: req.body.name,
            description: req.body.description,
            owner: ownerId,
            coordinates: {
                longitude: longitude,
                latitude: latitude
            },
            size: req.body.size,
            surface: req.body.surface,
            amenities: req.body.amenities,
            images: req.body.images,
            price: price,
            policy: req.body.policy,
            minimumSession: minimumSession,
            maximumSession: maximumSession
        }

        const pitch = await createPitchWithDetails({...data});
        res.status(200).json({success: true, message: "Created pitch successfully!", data: pitch });
    } catch (error: any) {
        res.status(400).json({success: false, message: `Failed to create new pitch. ${error.message}`})
    }
}