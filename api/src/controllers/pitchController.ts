import { Request, Response } from "express";
import { createPitchWithDetails, fetchPitchById } from "../services/pitchService";

export async function handleFetchPitches(req: Request, res: Response) {
    // takes in pin and radius params
    // takes in cursor and limit
    const params = req.query;
    res.send(params);
}

export async function handleFetchPitch(req: Request, res: Response) {
    try {
        const id = req.params.id;
    
        if (!id) {
            throw new Error("Please provide a valid pitch id to fetch data.")
        }
    
        const pitch = await fetchPitchById(id);
        res.status(200).json({success: true, message: pitch});
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
        res.status(200).json({success: true, message: `Created new pitch successfully with ID: ${pitch}.`});
    } catch (error: any) {
        res.status(400).json({success: false, message: `Failed to create new pitch. ${error.message}`})
    }
}