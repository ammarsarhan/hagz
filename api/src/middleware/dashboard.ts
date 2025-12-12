// To authorize dashboard access, we only need to identify whether or not the current user has the specified
// pitchId defined within the body in their actual pitches field in the database.

import prisma from "@/utils/prisma";
import { Request, Response, NextFunction } from "express";

export async function permit(req: Request, res: Response, next: NextFunction) {
    const pitchId = req.params.id || req.body.id;
    const userId = req.user?.sub;

    if (!pitchId || typeof pitchId !== "string") {
        return res.status(400).json({ message: "Could not fetch pitch data. ID was not passed into the query parameters.", data: null });
    };

    const pitch = await prisma.pitch.findUnique({
        where: { 
            id: pitchId,
            status: { notIn: ["DELETED", "SUSPENDED"] }
        },
        select: {
            status: true,
            owner: {
                select: {
                    userId: true
                }
            },
            permissions: {
                select: {
                    manager: {
                        select: { userId: true }
                    }
                }
            }
        }
    });

    if (!pitch) {
        return res.status(404).json({ message: "Could not find pitch with the specified ID.", data: null });
    };

    const isOwner = pitch.owner.userId === userId;
    const isManager = pitch.permissions.find(p => p.manager.userId === userId);

    if (!isOwner && !isManager) {
        return res.status(403).json({ message: "You are not authorized to access this resource. Please sign in with an authorized owner or manager account.", data: null })
    };

    next();
};
