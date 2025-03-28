import { Request, Response } from "express";
import { getGround, createGround, getPitchGrounds } from "../repositories/groundRepository";
import { z } from "zod";

export async function handleCreateGround(req: Request, res: Response) {
    try {
        const options = req.body;
        const pitchId = req.params.pitch;
        const { images, size, surface, price } = options;

        if (!images || !price || !size || !surface) {
            throw new Error("Please make sure all of the required fields are not empty.");
        }

        const schema = z.object({
            pitchId: z.string().cuid({ message: "Pitch ID must be a valid CUID." }),
            price: z.number({ message: "Please enter a valid price value." }).min(100, { message: "Hourly price must be 100 EGP at minimum." }).max(1000, { message: "Hourly price must be 1000 EGP at maximum." }),
            images: z.array(z.string().url({ message: "Images must be a list of valid URLs." }), { message: "Images must be a list of valid URLs." }),
            size: z.enum(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"], { message: "Selected pitch size must be one of available options." }),
            surface: z.enum(["NATURAL", "ARTIFICIAL"], { message: "Selected ground type must be one of available options." }),
        });

        const parsed = schema.safeParse({ 
            pitchId,
            price,
            images,
            size,
            surface
         });

        if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
        };

        const ground = await createGround({...parsed.data, ownerId: req.user.id });
        
        res.status(200).json({ success: true, data: ground });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleGetGround(req: Request, res: Response) {
    try {
        const index = parseInt(req.params.ground);
        const pitchId = req.params.pitch;
        const ground = await getGround(index, pitchId);

        res.status(200).json({ success: true, data: ground });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function handleFetchGrounds(req: Request, res: Response) {
    try {
        const id = req.params.pitch;
        const grounds = await getPitchGrounds(id);
        res.status(200).json({ success: true, data: grounds });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message })
    }
}
