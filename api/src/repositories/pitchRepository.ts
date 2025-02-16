import prisma from "../utils/db";

type PitchCreateResponse = {
    id: string;
};

type PitchCreateRequest = {
    name: string, 
    description: string, 
    owner: string, 
    longitude: number, 
    latitude: number
}

export async function getPitch(id: string) {
    try {
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: id
            }
        })

        if (!pitch) {
            throw new Error("Could not find pitch with specified credentials.");
        }

        return pitch;
    } catch (error: any) {
        throw new Error(`Could not fetch pitch. ${error.message}`)
    }
}

export async function createPitch(pitch: PitchCreateRequest) {
    try {
        const data: PitchCreateResponse[] = await prisma.$queryRaw`
            INSERT INTO "Pitch" ("id", "ownerId", "name", "description", "coordinates", "createdAt", "updatedAt") 
            VALUES (gen_random_uuid(), ${pitch.owner}, ${pitch.name}, ${pitch.description}, ST_SetSRID(ST_MakePoint(${pitch.longitude}, ${pitch.latitude}), 4326), NOW(), NOW())
            RETURNING id;
        `;
        
        if (data.length < 1) {
            throw new Error("Failed to create new pitch. Please try again later.");
        }

        const id = data[0].id;
        return id;
    } catch (error: any) {
        throw new Error(error.message);
    }
}