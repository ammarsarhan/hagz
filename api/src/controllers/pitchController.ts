import { Request, Response } from "express";
import { fetchPitchById } from "../services/pitchService";

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
    const ownerId = req.user.id;

    if (!ownerId) {
        throw new Error("No Owner ID provided within the request. Owner ID is required to create a pitch.");
    }

    const data = {
        name: req.body.name,
        description: req.body.description,
        owner: ownerId,
        coordinates: {
            longitude: req.body.longitude,
            latitude: req.body.latitude
        },
        size: req.body.size,
        surface: req.body.surface,
        amenities: req.body.amenities,
        images: [],
        price: req.body.price,
        policy: req.body.policy,
        minimumSession: req.body.minimumSession,
        maximumSession: req.body.maximumSession
    }

    console.log(data);
    res.send("Wasalna")
}