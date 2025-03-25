import { GroundSize, GroundSurface } from "@prisma/client";
import prisma from "../utils/db";

export async function createGround(data: { pitchId: string, images: string[], size: GroundSize, surface: GroundSurface }) {
    try {
        const ground = await prisma.ground.create({
            data: data
        })

        if (!ground) {
            throw new Error("Failed to create ground. Please try again later.");
        }

        return ground;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getGround(id: string, pitchId?: string) {
    try {
        const ground = await prisma.ground.findUnique({
            where: {
                id,
                pitchId
            }
        })

        if (!ground) {
            throw new Error("Failed to fetch ground. Please try again later.");
        }

        return ground;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getPitchGrounds(id: string) {
    try {
        const grounds = prisma.ground.findMany({
            where: {
                pitchId: id
            }
        });

        if (!grounds) {
            throw new Error("Failed to fetch pitch grounds. Please try again later.")
        }

        return grounds;
    } catch (error: any) {
        throw new Error(error.message);
    }
}