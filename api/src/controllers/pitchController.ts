import z, { email } from "zod";
import { Request, Response, NextFunction } from "express";
import { AccessRole, BookingSource, PitchStatus } from "generated/prisma";

import { checkBookingAvailability, getBookingDeadlines } from "@/services/bookingService";
import { ResolvedSettings, resolveEffectiveCombinationSettings, resolveEffectiveGroundSettings, settingsSchema } from "@/utils/dashboard";
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

    const settings = await prisma.pitchSettings.findUnique({
        where: {
            pitchId
        }
    });

    const invitations = await prisma.invitation.findMany({
        where: {
            pitchId
        }
    });

    const pitch = await prisma.pitch.findUnique({
        where: { 
            id: pitchId,
            status: { notIn: ["DELETED", "SUSPENDED"] }
        },
        include: { 
            permissions: { 
                include: { 
                    manager: { 
                        include: { 
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            } 
                        } 
                    } 
                } 
            },
            invitations: {
                select: {
                    email: true,
                    acceptedAt: true,
                },
            },
        },
    });

    if (!settings || !invitations || !pitch) {
        return res.status(404).json({ message: "Could not find pitch settings associated with the specified pitch ID. Please try again later.", data: null });
    };

    const managers = pitch.permissions.map(permission => {
        const email = permission.manager.user.email;
        const invitation = pitch.invitations.find(invitation => email === invitation.email);
        
        return {
            manager: {
                ...permission.manager,
                acceptedAt: invitation ? invitation.acceptedAt : null
            },
            permissions: {
                bookings: permission.bookings,
                payments: permission.payments,
                analytics: permission.analytics,
                settings: permission.settings,
                schedule: permission.schedule,
                scheduleExceptions: permission.scheduleExceptions
            }
        };
    });

    const status = pitch.status;

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

export async function createPitchBooking(req: Request, res: Response, next: NextFunction) {
    const id = req.user?.sub;
    const role = req.user?.role;
    const pitchId = req.params.id;

    if (!id || !role) return res.status(403).json({ message: "You are unauthorized to access/edit this resource. Please sign in with an authorized account and try again.", data: null });

    // Check if the user creating the booking has the necessary permissions to do so.
    if (role === "MANAGER") {
        const permissions = await prisma.managerPermissions.findFirst({
            where: {
                pitchId,
                manager: {
                    userId: id
                }
            }
        });

        if (!permissions || permissions.bookings != "WRITE") return res.status(403).json({ message: "Could not find permissions associated with the issuer or they do not have the required access to create a booking." });
    };

    // Prepare the data we need to create the booking and validate it.
    const schema = z.object({
        source: z.enum(Object.values(BookingSource)),
        user: z.object({
            firstName: z.
                string("First name is required.")
                .min(2, "First name must be at least 2 characters long.")
                .max(100, "First name may not be longer than 100 characters."),
            lastName: z
                .string("Last name is required.")
                .min(2, "Last name must be at least 2 characters long.")
                .max(100, "Last name may not be longer than 100 characters."),
            email: z
                .email("Please enter a valid email address.")
                .optional(),
            phone: z
                .string("Please enter a valid phone number.")
                .optional()
                .refine(val => !val || val.length === 0 || (val.length >= 10 && val.length <= 15), {
                    error: "Phone number must be between 10 and 15 characters if provided."
                }),
        }, "User object is required"),
        startDate: z
            .coerce.date("Start date is required."),
        endDate: z
            .coerce.date("End date is required."),
        combinationId: z.cuid().optional(),
        groundId: z.cuid().optional()
    }).superRefine((data, ctx) => {
        if (!data.user.email && !data.user.phone) {
            ctx.addIssue({
                code: "custom",
                path: ["email"],
                message: "Either email or phone number must be set."
            })
        };

        if (!data.combinationId && !data.groundId) {
            ctx.addIssue({
                code: "custom",
                path: ["groundId"],
                message: "Either groundId or combinationId must be set as a target."
            })
        }
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message, data: null });

    const payload = parsed.data;

    // We need to get the data about the user and decide whether we are dealing with a guest or user scenario.
    // First of all check if a user account with the specified email exists.
    let userConnection = {};
    let guestConnection = {};

    const existingUser = await prisma.user.findFirst({ where: { email: payload.user.email, phone: payload.user.phone }});
    
    if (existingUser) {
        userConnection = { connect: { id: existingUser.id } };
    } else {
        let existingGuest = await prisma.guest.findFirst({ where: { phone: payload.user.phone }});
        
        if (!existingGuest) {
            existingGuest = await prisma.guest.create({ 
                data: {
                    firstName: payload.user.firstName,
                    lastName: payload.user.lastName,
                    phone: payload.user.phone!
                }
            })
        };
        
        guestConnection = { connect: { id: existingGuest.id } };
    };

    // Then we need to calculate the deadlines, prices, and any metadata we are deadling with.
    let settings: ResolvedSettings = {
        minBookingHours: 1,
        maxBookingHours: 2,
        cancellationFee: 5,
        noShowFee: 5,
        advanceBooking: 1,
        peakHourSurcharge: 10,
        offPeakDiscount: 10,
        paymentDeadline: 2,
        cancellationGrace: 1
    };

    const pitchSettings = await prisma.pitchSettings.findUnique({ where: { pitchId } });
    if (!pitchSettings) return res.status(404).json({ message: "Could not find settings associated with the ID provided. Please try again with a valid pitch ID." });
    
    let targets: string[] = [];

    if (payload.groundId) {
        const ground = await prisma.ground.findFirst({ where: { id: payload.groundId }, include: { settings: true } });    
        if (!ground || !ground.settings) return res.status(404).json({ message: "Could not find active ground with the specified ID. Please try again with a valid ID." });

        settings = resolveEffectiveGroundSettings(ground.settings, pitchSettings)
        targets = [ground.id];
    };

    if (payload.combinationId) {
        const grounds = await prisma.ground.findMany({ 
            where: { combinations: { some: { id: payload.combinationId } } },
            include: { settings: true }
        });

        if (!grounds) return res.status(404).json({ message: "Coukd not find combination with the specified ID. Please try again with valid ID." });
        const targetSettings = grounds.map(g => g.settings).filter((s) => s !== null);
        settings = resolveEffectiveCombinationSettings(targetSettings, pitchSettings).settings;
        targets = grounds.map(g => g.id);
    };

    const { paymentDeadline, cancellationDeadline } = getBookingDeadlines(settings, payload.startDate);

    const result = await checkBookingAvailability({...payload, pitchId, issuerId: id}, settings);
    if (!result.success) return res.status(result.error.code).json({ message: result.error.message })

    // Finally we will create the booking record within the database.
    const booking = await prisma.$transaction(async (tx) => {
        const data = await tx.booking.create({
            data: {
                referenceCode: result.data.referenceCode,
                source: payload.source,
                issuer: { connect: { id } },
                paymentDeadline,
                cancellationDeadline,
                grounds: {
                    connect: targets.map(id => ({ id }))
                },
                totalPrice: result.data.price,
                startDate: payload.startDate,
                endDate: payload.endDate,
                status: existingUser ? "PENDING" : "CONFIRMED",
                ...(existingUser
                    ? { user: userConnection }
                    : { guest: guestConnection })
            }
        });

        return data;
    });

    if (!booking) return res.status(500).json({ message: "Could not create a new booking. Please try again later." });
    return res.status(201).json({ message: "Created a new booking successfully.", data: { booking } });
};

export async function checkPitchAvailability(req: Request, res: Response, next: NextFunction) {
    const id = req.user?.sub;
    const role = req.user?.role;
    const pitchId = req.params.id;

    if (!id || !role) return res.status(403).json({ message: "You are unauthorized to access/edit this resource. Please sign in with an authorized account and try again.", data: null });

    // Check if the user creating the booking has the necessary permissions to do so.
    if (role === "MANAGER") {
        const permissions = await prisma.managerPermissions.findFirst({
            where: {
                pitchId,
                manager: {
                    userId: id
                }
            }
        });

        if (!permissions || permissions.bookings != "WRITE") return res.status(403).json({ message: "Could not find permissions associated with the issuer or they do not have the required access to create a booking." });
    };

    const schema = z.object({
        source: z.enum(Object.values(BookingSource)),
        startDate: z
            .coerce.date("Start date is required."),
        endDate: z
            .coerce.date("End date is required."),
        combinationId: z.cuid().optional(),
        groundId: z.cuid().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message, data: null });

    const payload = parsed.data;

    let settings: ResolvedSettings = {
        minBookingHours: 1,
        maxBookingHours: 2,
        cancellationFee: 5,
        noShowFee: 5,
        advanceBooking: 1,
        peakHourSurcharge: 10,
        offPeakDiscount: 10,
        paymentDeadline: 2,
        cancellationGrace: 1
    };

    const pitchSettings = await prisma.pitchSettings.findUnique({ where: { pitchId } });
    if (!pitchSettings) return res.status(404).json({ message: "Could not find settings associated with the ID provided. Please try again with a valid pitch ID." });
    
    if (payload.groundId) {
        const ground = await prisma.ground.findFirst({ where: { id: payload.groundId }, include: { settings: true } });    
        if (!ground || !ground.settings) return res.status(404).json({ message: "Could not find active ground with the specified ID. Please try again with a valid ID." });

        settings = resolveEffectiveGroundSettings(ground.settings, pitchSettings)
    };

    if (payload.combinationId) {
        const grounds = await prisma.ground.findMany({ 
            where: { combinations: { some: { id: payload.combinationId } } },
            include: { settings: true }
        });

        if (!grounds) return res.status(404).json({ message: "Coukd not find combination with the specified ID. Please try again with valid ID." });
        const targetSettings = grounds.map(g => g.settings).filter((s) => s !== null);
        settings = resolveEffectiveCombinationSettings(targetSettings, pitchSettings).settings;
    };

    const result = await checkBookingAvailability({ ...payload, pitchId, issuerId: id }, settings);
    if (!result.success) return res.status(result.error.code).json({ message: result.error.message, data: null })

    return res.status(200).json({ message: "Found an empty booking slot for the specified target successfully.", data: result.data });
};
