import prisma from "@/utils/prisma";
import { generateInvitationToken } from "@/utils/token";
import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import z from "zod";

export async function createInvitation(req: Request, res: Response, next: NextFunction) {    
    const id = req.user?.sub;

    if (!id) {
        return res.status(401).json({ message: "Invalid access token provided. Please sign in and try again." });
    };

    const schema = z.object({
        id: z.string(),
        firstName: z.string({ error: "Please provide a valid first name." })
            .min(2, { error: "First name must be at least 2 characters." })
            .max(100, { error: "First name must be at most 100 characters." }),
        lastName: z.string({ error: "Please provide a valid last name." })
            .min(2, { error: "Last name must be at least 2 characters." })
            .max(100, { error: "Last name must be at most 100 characters." }),
        email: z.email({ error: "Please provide a valid email address." }),
        message: z.string()
            .max(500, "Additional message may not be longer than 500 characters.")
            .trim()
            .transform((val) => (val === "" ? null : val))
            .nullable(),
        expiresIn: z.enum([ "1", "7", "30" ])
    });

    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    };

    // Check if the user is already an manager or an owner for the specified pitch.
    const owner = await prisma.owner.findFirst({
        where: {
            user: {
                email: parsed.data.email
            },
            pitches: {
                some: {
                    id: parsed.data.id
                }
            }
        }
    });

    if (owner) {
        return res.status(400).json({ message: "Failed to create a manager invitation. The specified email address is already an owner for this pitch." });
    };

    const manager = await prisma.manager.findFirst({
        where: {
            user: {
                email: parsed.data.email
            },
            pitches: {
                some: {
                    id: parsed.data.id
                }
            }
        }
    });

    if (manager) {
        return res.status(400).json({ message: "Failed to create a manager invitation. A user with the specified email address is already a manager for this pitch." });
    };

    // Check if an invitation for the specified email and pitch already exists.
    const invitations = await prisma.invitation.findMany({
        where: {
            pitchId: parsed.data.id,
            email: parsed.data.email
        }
    });

    // Check if there are any PENDING invitations, we want to have only one PENDING invitation per email and pitch.
    const pending = invitations.find((invitation) => invitation.status === "PENDING");

    if (pending) {
        return res.status(400).json({ message: "Failed to create a manager invitation. There is already a pending invitation for the specified email address and pitch." });
    };

    const now = new Date();

    const expiryFactor = Number(parsed.data.expiresIn) * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + expiryFactor);

    const invitationId = randomUUID();
    const token = await generateInvitationToken(invitationId, randomUUID(), parsed.data.expiresIn);

    const issuer = await prisma.owner.findUnique({
        where: { userId: id },
        select: { id: true }
    });

    if (!issuer) {
        return res.status(403).json({ message: "You do not have permission to create an invitation for the specified pitch." });
    };

    const invitation = await prisma.invitation.create({
        data: {
            id: invitationId,
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            message: parsed.data.message,
            pitchId: parsed.data.id,
            issuerId: issuer.id,
            expiresAt,
            token,
        }
    });

    return res.status(201).json({ message: "Created a new invitation successfully.", data: invitation });
};

export async function fetchInvitation(req: Request, res: Response, next: NextFunction) {
    const { token } = req.params;
    const id = req.user?.sub;

    if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Could not fetch invitation. Token not provided in params." });
    };

    const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: {
            issuer: {
                select: {
                    user: {
                        select: {
                        firstName: true,
                        lastName: true,
                        },
                    },
                },
            },
            pitch: {
                select: { name: true },
            },
        },
    });

    if (!invitation) {
        return res.status(404).json({ message: "Could not find invitation with the specified token.", data: null });
    };

    let user = null;
    let requiresUser = false;
    let requiresAuth = false;

    // If the request has a signed-in user
    if (id) {
        user = await prisma.user.findFirst({
            where: {
                id,
                status: { notIn: ["SUSPENDED", "DELETED"] },
            },
        });

        if (!user) {
            return res.status(403).json({ message: "Could not fetch user account with the specified ID. Please try again later." });
        };
    };

    // Check if a user exists with the invited email
    const userExists = await prisma.user.findUnique({
        where: { email: invitation.email },
    });

    if (!userExists) {
        requiresUser = true;
    };

    // If a user is signed in and doesn't match the invitation email
    if (user && user.email !== invitation.email) {
        requiresAuth = true;
    };

    const { email, ...data } = invitation;
    const updated = { ...data, requiresUser, requiresAuth };

    return res.status(200).json({
        message: "Fetched invitation data successfully.",
        data: updated,
    });
};

export async function updateInvitation(req: Request, res: Response, next: NextFunction) {
    const { token } = req.params;
    const { action } = req.body;
    const id = req.user?.sub;

    if (!id) return res.status(401).json({ message: "Could not find a user with the specified ID. Please sign in and try again." });

    const user = await prisma.user.findFirst({
        where: { 
            id,
            status: { notIn: ["SUSPENDED", "DELETED"] }
        },
        include: {
            manager: true,
            owner: true
        }
    });

    const invitation = await prisma.invitation.findFirst({
        where: {
            token,
            status: "PENDING"
        }
    });

    const schema = z.enum(["ACCEPT", "REJECT"]);
    const parsed = schema.safeParse(action);

    if (!parsed.success) return res.status(400).json({ message: "Could not update invitation status. Please request a valid action and try again." });

    if (!user) return res.status(404).json({ message: "Could not find a user with the specified ID. Please sign in and try again." });
    if (!invitation || invitation.expiresAt < new Date()) return res.status(404).json({ message: "The requested invitation either does not exist, has already been accepted/rejected, or has already expired. Please use an invitation with a valid token and try again." });
    if (invitation.email != user.email) return res.status(403).json({ message: "You do not have the required permissions to accept/reject this invitation." });
    
    try {
        const result = await prisma.$transaction(async (tx) => {
            if (action === "ACCEPT") {
                const manager = await tx.manager.upsert({
                    where: { userId: id },
                    update: {},
                    create: { userId: id },
                });

                // Connect manager to the pitch
                await tx.manager.update({
                    where: { id: manager.id },
                    data: {
                        pitches: {
                        connect: { id: invitation.pitchId }
                        }
                    }
                });

                // Upsert permissions
                await tx.managerPermissions.upsert({
                    where: {
                        id: {
                        managerId: manager.id,
                        pitchId: invitation.pitchId,
                        }
                    },
                    update: {},
                    create: {
                        managerId: manager.id,
                        pitchId: invitation.pitchId,
                    },
                });

                // Update invitation
                const updated = await tx.invitation.update({
                    where: { token },
                    data: {
                        status: "ACCEPTED",
                        acceptedAt: new Date(),
                    },
                });

                return updated;
            };

            if (action === "REJECT") {
                const updated = await tx.invitation.update({
                    where: { token },
                    data: {
                        status: "REJECTED",
                        acceptedAt: null,
                    },
                });
                return updated;
            };

            throw new Error("Invalid action provided.");
        });

        return res.status(200).json({ message: `Updated invitation state successfully.`, data: result });
    } catch (error: any) {
        return res.status(500).json({ message: error.message, data: null });
    };
}
