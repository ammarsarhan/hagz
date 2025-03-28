import { GroundSize, GroundSurface } from "@prisma/client";
import prisma from "../utils/db";

export async function createGround(data: { ownerId: string, pitchId: string, price: number, images: string[], size: GroundSize, surface: GroundSurface }) {
    try {
        const pitch = await prisma.pitch.findUnique({
            where: {
                id: data.pitchId,
                ownerId: data.ownerId
            },
            include: {
                grounds: {
                    select: {
                        id: true
                    }
                }
            }
        });

        if (!pitch) {
            throw new Error("Pitch not found. Please make sure you are the owner of the pitch.");
        };

        const ground = await prisma.ground.create({
            data: { 
                index: pitch.grounds.length == 0 ? 1 : pitch.grounds.length + 1,
                pitchId: data.pitchId,
                price: data.price,
                images: data.images,
                size: data.size,
                surface: data.surface
            }
        });

        if (!ground) {
            throw new Error("Failed to create ground. Please try again later.");
        }

        return ground;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getGround(index: number, pitchId?: string) {
    try {
        const ground = await prisma.ground.findFirst({
            where: {
                pitchId,
                index
            }
        })

        if (!ground) {
            throw new Error("Failed to fetch ground. Please try again later.");
        };

        return ground;
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getPitchPriceRange(id: string) {
    try {
        const grounds = await prisma.ground.findMany({
            where: {
                pitchId: id
            }
        });

        if (!grounds) {
            throw new Error("Could not find grounds for specified pitch. Please try again later.")
        }

        if (grounds.length == 0) {
            return [];
        }

        if (grounds.length == 1) {
            const price = grounds[0].price;
            return [price, price];
        }

        let minimumPrice = grounds[0].price;
        let maximumPrice = grounds[0].price;

        grounds.map(ground => {
            if (ground.price < minimumPrice) {
                minimumPrice = ground.price;
            } else if (ground.price > maximumPrice) {
                maximumPrice = ground.price;
            }
        });

        return [minimumPrice, maximumPrice];
    } catch (error: any) {
        throw new Error(error.message);
    }
}

export async function getPitchGrounds(id: string) {
    try {
        const grounds = await prisma.ground.findMany({
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