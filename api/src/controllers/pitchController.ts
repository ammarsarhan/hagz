import { Request, Response } from "express";
import { createPitchWithDetails, getPaginatedPitches, fetchPitchById, getPitchesWithinRadius, updatePitchField, searchForPitches } from "../services/pitchService";
import { getPitchData } from "../repositories/pitchRepository";

export async function handleQueryPitches(req: Request, res: Response) {
    try {
        const params = req.query;
    
        if (!(params.longitude && params.latitude && params.radius)) {
            throw new Error("Please provide a valid longitude/latitude & radius combination.")
        }

        const lng = Number(params.longitude);
        const lat = Number(params.latitude);

        const radius = Number(params.radius) || 1;
        
        const pitches = await getPitchesWithinRadius(lng, lat, radius);
        res.status(200).json({ success: true, message: "Fetched all pitches within specified radius.", data: pitches });
    } catch (error: any) {
        res.status(400).json({ success: false, message: `Failed to fetch pitch data. ${error.message}` });
    }
}

export async function handleSearchPitches(req: Request, res: Response) {
    try {
        const query = req.query.keywords as string;

        if (!query) {
            throw new Error("Please provide valid keywords to search for pitches.")
        }
        const data = await searchForPitches(query);
        res.status(200).json({ success: true, message: "Fetched all pitches matching the search query.", data: data });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message })
    }
}

export async function handleGetPitches(req: Request, res: Response) {
    try {
        const limit = Number(req.query.limit) || 10;
        const cursor = req.query.timestamp as string;
        
        const data = await getPaginatedPitches(cursor, limit);

        res.status(200).json({ 
            success: true, 
            message: `Fetched ${data.pitches.length} pitches successfully.`, 
            data: data 
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleFetchPitch(req: Request, res: Response) {
    try {
        const id = req.params.pitch;
    
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
    try {
        const id = req.params.pitch;
        const field = req.params.field;
        const value = req.body.value;
        
        if (!value) {
            throw new Error("Please provide a value for the field to be set.")
        }

        const updated = await updatePitchField(id, field, value);
        res.status(200).json({success: true, message: "Updated pitch data successfully!", data: updated });

    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleCreatePitchRequest(req: Request, res: Response) {
    try {
        const ownerId = req.user.id;

        if (!ownerId) {
            throw new Error("No Owner ID provided within the request. Owner ID is required to create a pitch.");
        }

        if (!req.body.name || !req.body.description || !req.body.longitude || !req.body.latitude || !req.body.size || !req.body.surface || !req.body.amenities || !req.body.images || !req.body.price || !req.body.settings || !req.body.location || !req.body.minimumSession || !req.body.maximumSession) {
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
            settings: req.body.settings,
            location: req.body.location,
            minimumSession: minimumSession,
            maximumSession: maximumSession
        }

        const pitch = await createPitchWithDetails({...data});
        res.status(200).json({success: true, message: "Created pitch successfully!", data: pitch });
    } catch (error: any) {
        res.status(400).json({success: false, message: `Failed to create new pitch. ${error.message}`})
    }
}

export async function handleFetchPitchSettings(req: Request, res: Response) {
    try {
        const pitchId = req.params.pitch;
        const data = await getPitchData(pitchId, ["settings", "coordinates"]);
        
        res.status(200).json({ success: true, message: "Fetched pitch settings successfully!", data: data });
    } catch (error: any) {
        res.status(400).json({ success: false, message: `Failed to fetch pitch settings. ${error.message}` })
    }
}
