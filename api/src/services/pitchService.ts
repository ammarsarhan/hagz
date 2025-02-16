import * as z from 'zod';
import { createPitch, getPitch } from '../repositories/pitchRepository';

export async function createPitchWithDetails(name: string, description: string, owner: string, coordinates: {longitude: number, latitude: number}) {
    try {
        const schema = z.object({
            name: z.string(),
            description: z.string(),
            owner: z.string(),
            longitude: z.number(),
            latitude: z.number()
        })

        const parsed = schema.safeParse({ 
            name: name, 
            description: description, 
            owner: owner, 
            longitude: coordinates.longitude, 
            latitude: coordinates.latitude 
        });
    
        if (parsed.error) {
            throw new Error(parsed.error.errors[0].message);
        }

        await createPitch({...parsed.data});
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