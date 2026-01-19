import z from "zod";
import { Request, Response, NextFunction } from "express";
import { AccessRole, PitchStatus } from "generated/prisma";

import { settingsSchema } from "@/utils/dashboard";
import prisma from "@/utils/prisma";

export async function fetchPitchState(req: Request, res: Response, next: NextFunction) {
    const pitchId = req.params.id;

    if (!pitchId || typeof pitchId !== "string") {
        return res.status(400).json({ message: "Could not fetch pitch data. ID was not passed into the query parameters.", data: null });
    };

    const pitch = await prisma.pitch.findUnique({
        where: {
            id: pitchId,
            status: { in: ["APPROVED", "ARCHIVED", "LIVE"] }
        },
        select: {
            id: true,
            name: true,
            status: true,
            owner: true,
            managers: true,
            settings: {
                select: {
                    automaticBookings: true,
                    advanceBooking: true,
                    paymentDeadline: true,
                    depositFee: true,
                    minBookingHours: true,
                    maxBookingHours: true,
                    cancellationGrace: true
                }
            },
            layout: {
                select: {
                    grounds: {
                        select: {
                            id: true,
                            name: true,
                            combinations: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!pitch) {
        return res.status(404).json({ message: "Could not find pitch associated with the specified pitch ID. Please try again later.", data: null });
    };
    
    return res.status(200).json({ message: "Fetched pitch for the specified pitch ID successfully!", data: pitch });
};

export async function fetchPitchData(req: Request, res: Response, next: NextFunction) {
    const pitchId = req.params.id;

    if (!pitchId || typeof pitchId !== "string") {
        return res.status(400).json({ message: "Could not fetch pitch data. ID was not passed into the query parameters." });
    };

    const pitch = await prisma.pitch.findUnique({
        where: {
            id: pitchId,
            status: { notIn: ["DELETED", "SUSPENDED"] }
        },
        include: {
            layout: {
                include: {
                    grounds: true,
                    combinations: true
                }
            }
        }
    });

    if (!pitch) {
        return res.status(404).json({ message: "Could not find pitch associated with the specified pitch ID. Please try again later." });
    };

    return res.status(200).json({ message: "Fetched pitch for the specified pitch ID successfully!", data: pitch });
};

export async function fetchPitchSettings(req: Request, res: Response, next: NextFunction) {
    const pitchId = req.params.id;

    if (!pitchId || typeof pitchId !== "string") {
        return res.status(400).json({ message: "Could not fetch pitch data. ID was not passed into the query parameters." });
    };

    const [settings, pitch] = await Promise.all([
        prisma.pitchSettings.findUnique({ where: { pitchId } }),
        prisma.pitch.findUnique({
            where: { id: pitchId, status: { notIn: ["DELETED", "SUSPENDED"] } },
            include: {
                permissions: {
                    include: {
                        manager: {
                            include: {
                                user: { select: { firstName: true, lastName: true, email: true } },
                            },
                        },
                    },
                },
                invitations: { select: { email: true, acceptedAt: true, firstName: true, lastName: true, status: true, createdAt: true, expiresAt: true, token: true } },
            },
        }),
    ]);

    if (!settings || !pitch) {
        return res.status(404).json({ message: "Could not find pitch settings associated with the specified pitch ID. Please try again later.", data: null });
    };

    const invitationMap = Object.fromEntries(
        pitch.invitations.map(inv => [inv.email, inv.acceptedAt])
    );

    const managers = pitch.permissions.map(permission => {
        const email = permission.manager.user.email;

        return {
            manager: {
                ...permission.manager,
                acceptedAt: invitationMap[email!] ?? null,
            },
            permissions: {
                bookings: permission.bookings,
                payments: permission.payments,
                analytics: permission.analytics,
                settings: permission.settings,
                schedule: permission.schedule,
                scheduleExceptions: permission.scheduleExceptions,
            },
        };
    });

    const status = pitch.status;
    const invitations = pitch.invitations;

    return res.status(200).json({ message: "Fetched pitch settings for the specified pitch ID successfully!", data: { settings, invitations, managers, status } });
};

export async function updatePitchSettings(req: Request, res: Response, next: NextFunction) {
    const pitchId = req.params.id;

    if (!pitchId || typeof pitchId !== "string") {
        return res.status(400).json({ message: "Could not fetch pitch data. ID was not passed into the query parameters." });
    };

    const { settings } = req.body;

    if (!settings) {
        return res.status(400).json({ message: "Could not update pitch settings. Settings were not provided in the request body." });
    };

    const schema = settingsSchema;
    const parsed = schema.safeParse(settings);

    if (!parsed.success) {
        return res.status(400).json({ message: "Could not update pitch settings. Provided settings are invalid.", error: parsed.error.issues[0].message });
    };

    try {
        const updated = await prisma.pitchSettings.update({
            where: {
                pitchId
            },
            data: {
                ...parsed.data
            }
        });
    
        return res.status(200).json({ message: "Updated pitch settings successfully!", data: updated });
    } catch (error) {
        res.status(500).json({ message: "Could not update pitch settings. An unexpected error occurred. Please try again later.", error });
    };
}

export async function updatePitchStatus(req: Request, res: Response, next: NextFunction) {
    const pitchId = req.params.id;
    const id = req.user?.sub;
    const action = req.body.action;

    if (!pitchId || typeof pitchId !== "string") {
        return res.status(400).json({ message: "Could not fetch pitch data. ID was not passed into the query parameters." });
    };

    const schema = z.enum(Object.values(PitchStatus), "Please specify a valid pitch status type.");
    const parsed = schema.safeParse(action);

    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

    const user = await prisma.user.findUnique({
        where: { 
            id,
            status: { notIn: ["DELETED", "SUSPENDED"] }
        },
        select: {
            owner: {
                select: {
                    pitches: true
                }
            },
            manager: {
                select: {
                    pitches: true,
                    permissions: true
                }
            }
        }
    });

    if (!user) return res.status(404).json({ message: "Could not fetch user data. Please log in again and try again." });

    if (user.owner) {
        const isOwner = user.owner.pitches.find(pitch => pitch.id === pitchId);
        if (!isOwner) return res.status(403).json({ message: "Could not archive pitch with the specified ID. Please log in as the owner or an authorized manager and try again." });
    };

    if (user.manager) {
        const permissions = user.manager.permissions.find(item => item.pitchId === pitchId);
        if (!permissions || permissions.settings != "WRITE") return res.status(403).json({ message: "Could not archive pitch with the specified ID. Please log in as the owner or an authorized manager and try again." });
    };

    const updated = await prisma.pitch.update({
        where: { id: pitchId },
        data: {
            status: action
        }
    });

    if (!updated) return res.status(500).json({ message: "Failed to archive pitch. A server-side error has occurred. Please try again later." });

    return res.status(200).json({ message: "Pitch with the specified ID has been archived successfully." });
};

export async function updatePitchPermissions(req: Request, res: Response, next: NextFunction) {
    const pitchId = req.params.id;
    const id = req.user?.sub;
    const managerId = req.body.id;
    const payload = req.body.permissions;

    if (!pitchId || typeof pitchId !== "string") {
        return res.status(400).json({ message: "Could not fetch pitch data. ID was not passed into the query parameters.", data: null });
    };

    if (!id) {
        return res.status(403).json({ message: "You are unauthorized to access/edit this resource. Please sign in with an authorized account and try again.", data: null });
    };

    const schema = z.object({
        bookings: z.enum(Object.values(AccessRole), "Please specify a valid pitch status type for bookings."),
        analytics: z.enum(Object.values(AccessRole), "Please specify a valid pitch status type for analytics."),
        settings: z.enum(Object.values(AccessRole), "Please specify a valid pitch status type for settings."),
        payments: z.enum(Object.values(AccessRole), "Please specify a valid pitch status type for payments."),
        schedule: z.enum(Object.values(AccessRole), "Please specify a valid pitch status type for schedule."),
        scheduleExceptions: z.enum(Object.values(AccessRole), "Please specify a valid pitch status type for schedule exceptions."),
    });

    const parsed = schema.safeParse(payload);

    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message, data: null });

    const manager = await prisma.manager.findUnique({
        where: {
            userId: managerId
        }
    });

    if (!manager) return res.status(404).json({ message: "Could not find a manager account with the specified ID. Please make sure the account still exists and try again." })

    const updated = await prisma.managerPermissions.update({
        where: {
            id: {
                pitchId,
                managerId: manager.id
            }
        },
        data: {
            ...parsed.data
        }
    });

    if (!updated) return res.status(500).json({ message: "Could not updated manager permissions. Please try again later.", data: null });
    return res.status(200).json({ message: "Updated manager pitch permissions successfully.", data: updated });
};
