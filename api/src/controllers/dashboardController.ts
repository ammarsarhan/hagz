import { Request, Response, NextFunction } from 'express';
import prisma from '@/utils/prisma';
import { 
    getDashboardStage,
    getPitchDraftStep, 
    draftStepToIndex, 
    detailsSchema,
    settingsSchema,
    layoutSchema,
    scheduleSchema,
    DraftStep,
    PitchDetails,
    PitchSettings,
    resolveUserRole,
    fetchActivePitches,
    resolveEffectiveGroundSettings
} from '@/utils/dashboard';

export async function fetchDashboard(req: Request, res: Response, next: NextFunction) {
    const id = req.user?.sub;
    const role = req.user?.role;

    if (!id || !role) {
        return res.status(401).json({ message: "Could not fetch dashboard data. User not authenticated properly." });
    };
    
    const pitches = await fetchActivePitches(id);
    const user = await prisma.user.findUnique({ where: { id, status: { notIn: ["SUSPENDED", "DELETED" ] } } });
    
    if (!user) return res.status(401).json({ message: "Could not find user with the specified ID. Please sign in and try again later." })
    if (role === "USER") return res.status(403).json({ message: "You do not have permission to access the dashboard. Please sign in using an authorized account and try again." });
    
    const stage = await getDashboardStage(role, id);

    return res.status(200).json({ 
        message: "Fetched dashboard data successfully.", 
        data: {
            user: {
                role,
                status: user.status,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            },
            pitches,
            stage
        }
    });
};

export async function fetchPitchCreateState(req: Request, res: Response, next: NextFunction) {
    const id = req.user?.sub;
    
    if (!id) {
        return res.status(401).json({ message: "Could not fetch dashboard data. User not authenticated properly." });
    };

    const role = await resolveUserRole(id);

    if (role != "OWNER") {
        return res.status(403).json({ message: "You do not have permission to access this resource. Please sign in using an authorized account and try again." });
    };

    try {
        // Fetch the user's pitch creation state.
        // Implement this using a transaction to prevent race conditions.
        const result = await prisma.$transaction(async (tx) => {
            const user = await prisma.user.findUnique({
                where: { 
                    id,
                    status: { notIn: ["DELETED", "SUSPENDED"] }
                },
                include: {
                    owner: {
                        include: {
                            pitches: {
                                include: {
                                    settings: true,
                                    layout: {
                                        include: {
                                            combinations: {
                                                include: {
                                                    grounds: {
                                                        include: {
                                                            settings: true
                                                        }
                                                    },
                                                    settings: true
                                                }
                                            },
                                            grounds: {
                                                include: {
                                                    settings: true
                                                }
                                            }
                                        }
                                    },
                                    schedule: true
                                }
                            }
                        }
                    }
                }
            });
            
            if (!user) {
                return {
                    status: 404,
                    message: "Could not find user with the specified ID. Please sign in and try again later."
                };
            };

            // If a draft exists compute the step we're at and send it back for handling on the frontend.
            // TODO: Make sure that a database-level constraint has been added in the migrations to add an extra layer of security

            const draft = user.owner?.pitches.find((pitch) => pitch.status === "DRAFT");

            if (draft) {
                const step = getPitchDraftStep(draft);

                return {
                    status: 200,
                    message: "A pitch draft for this owner account already exists. Either continue editing the existing draft or submit a new one.",
                    data: {
                        pitches: [draft],
                        step: {
                            key: step,
                            index: draftStepToIndex[step]
                        },
                        isPending: false,
                        isDraft: true
                    }
                };
            };
            
            // If a pitch has already been sent at a pending state, send it back to show the user and do not allow new draft creation.
            const pending = user.owner?.pitches.find((pitch) => pitch.status === "PENDING");

            if (pending) {
                return {
                    status: 200,
                    message: "Your pitch is currently under review. Please wait for our team to get back to you.",
                    data: {
                        pitches: [pending],
                        step: null,
                        isPending: true,
                        isDraft: false
                    }
                };
            };
            
            if (!pending && !draft) {
                return {
                    status: 200,
                    message: "No initial pitch creation stage found. Please proceed with the pitch creation process.",
                    data: {
                        pitches: user.owner?.pitches || [],
                        step: null,
                        isPending: false,
                        isDraft: false
                    }
                };
            };

            return {
                status: 500,
                error: "An unexpected error occurred while fetching pitch creation state. Please try again later."
            };
        });

        if (result.error) {
            res.status(result.status).json({ message: result.error });
        };

        if (result.status === 200) {
            res.status(result.status).json({ message: result.message, data: result.data });
        };
    } catch (error: any) {
        return res.status(500).json({ message: "A server-side error occurred while fetching pitch creation state.", error: error.message });
    }
}

// We want to create a multistep POST request.
// Each step will have a certain key that will be associated with a Zod schema to validate the incoming request body against.
// TODO: We also need a way to ensure that the draft previous steps are complete before allowing the user to go through with the current step.
// On the final step we want to update the pitch details and make the pitch state pending rather than a draft.

export async function createPitchRequest(req: Request, res: Response, next: NextFunction) {
    const id = req.user?.sub;
    
    if (!id) {
        return res.status(401).json({ message: "Could not create pitch draft. User not authenticated properly. Please sign in again." });
    };

    const role = await resolveUserRole(id);

    if (role != "OWNER") {
        return res.status(403).json({ message: "You do not have permission to access this resource. Please sign in using an authorized account and try again." });
    };

    try {
        // First of all check if any other DRAFT or PENDING state pitches exist for this owner account.
        const owner = await prisma.owner.findUnique({
            where: {
                userId: id
            },
            include: {
                pitches: {
                    include: {
                        settings: true,
                        layout: {
                            include: {
                                combinations: true,
                                grounds: true
                            }
                        },
                        schedule: true
                    }
                }
            }
        });

        if (!owner) {
            return res.status(400).json({ message: "Could not find owner data associated with the current user. Please sign in and try again later." })
        };

        const pitches = owner.pitches;

        // Check if the user already has a PENDING pitch and return an approriate response if they try to create a draft.
        const pending = pitches.find(pitch => pitch.status === "PENDING");
        if (pending) return res.status(400).json({ message: "Could not create or update the current pitch. A pending pitch awaiting approval already exists." });
        
        // For the first step, check if a DRAFT already exists.
        // If it does then a user is trying to update that step for that pitch, validate the data and update the pitch.
        // If it does not, then validate that data against its schema and create the draft.

        const step = req.body.step as DraftStep;
        if (!step) return res.status(400).json({ message: "Could not parse current draft step. Please refresh and try again. If this issue persists, contact owner support." })
        
        const draft = pitches.find(pitch => pitch.status === "DRAFT");
        
        switch (step) {
            case "DETAILS":
                {
                    const schema = detailsSchema;
                    
                    const parsed = schema.safeParse(req.body.data);
                    const data = parsed.data as PitchDetails;

                    if (!parsed.success) {
                        return res.status(400).json({ message: parsed.error.issues[0].message })
                    };

                    // If a draft already exists, update the pitch details and send it back for further use.
                    if (draft) {
                        const id = draft.id;

                        try {
                            const updated = await prisma.pitch.update({
                                where: { id },
                                data: {
                                    ...data,
                                    ownerId: owner.id
                                }
                            });

                            return res.status(200).json({ message: "Updated pitch draft details successfully.", data: updated });
                        } catch (error: any) {
                            return res.status(500).json({ message: `Could not update pitch draft details. ${error.message}` })
                        };
                    };

                    // If a draft does not exist, create one.
                    try {
                        const pitch = await prisma.pitch.create({ 
                            data: {
                                ...data,
                                ownerId: owner.id
                            }    
                        });

                        return res.status(200).json({ message: "Created pitch draft and appended details successfully.", data: pitch }); 
                    } catch (error: any) {
                        return res.status(500).json({ message: `Could not create pitch draft with details. ${error.message}` });
                    };
                }
            case "SETTINGS":
                {
                    const schema = settingsSchema;
                    const parsed = schema.safeParse(req.body.data);
                    const data = parsed.data as PitchSettings;
                    
                    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
                    if (!draft) return res.status(400).json({ message: "Could not find an existing pitch draft to update. Please create a new pitch draft." });
                    
                    try {
                        const settings = await prisma.pitchSettings.upsert({
                            where: { pitchId: draft.id },
                            create: { ...data, pitchId: draft.id },
                            update: { ...data },
                        });

                        return res.status(200).json({
                            message: "Upserted pitch draft settings successfully.",
                            data: settings,
                        });
                    } catch (error: any) {
                        return res.status(500).json({
                            message: `Could not upsert pitch draft settings. ${error.message}`,
                            data: null
                        });
                    }
                }
            case "LAYOUT":
                {
                    const schema = layoutSchema;

                    const parsed = schema.safeParse(req.body.data);
                    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message, path: parsed.error.issues[0].path });
                    if (!draft) return res.status(400).json({ message: "Could not find an existing pitch draft to update. Please create a new pitch draft." });

                    const data = parsed.data;
                    const pitchSettings = await prisma.pitchSettings.findUnique({ where: { pitchId: draft.id } });

                    if (!pitchSettings) return res.status(400).json({ message: "Could not find pitch settings. Layout step depends on settings set in the previous stage." });

                    data.grounds.forEach(ground => {
                        const settings = resolveEffectiveGroundSettings(ground.settings, pitchSettings);
                        if (settings.minBookingHours > settings.maxBookingHours) return res.status(400).json({ message: "Could not update pitch layout. Maximum booking hours must be greater than minimum booking hours." });
                    });

                    data.combinations.forEach(combination => {
                        const settings = resolveEffectiveGroundSettings(combination.settings, pitchSettings);
                        if (settings.minBookingHours > settings.maxBookingHours) return res.status(400).json({ message: "Could not update pitch layout. Maximum booking hours must be greater than minimum booking hours." });
                    });

                    const result = await prisma.$transaction(async (tx) => {
                        // Ensure a single layout exists for this draft
                        const layout = await tx.layout.upsert({
                            where: { pitchId: draft.id },
                            create: { pitchId: draft.id },
                            update: {},
                            include: {
                                grounds: true,
                                combinations: true
                            }
                        });

                        // Delete old grounds & combinations to prevent duplicates
                        await tx.combinationSettings.deleteMany({ where: { combination: { layoutId: layout.id } } });
                        await tx.groundSettings.deleteMany({ where: { ground: { layoutId: layout.id } } });

                        await tx.combination.deleteMany({ where: { layoutId: layout.id } });
                        await tx.ground.deleteMany({ where: { layoutId: layout.id } });

                        // Re-insert fresh grounds
                        for (const ground of data.grounds) {
                            await tx.ground.create({
                                data: {
                                    ...ground,
                                    layoutId: layout.id,
                                    settings: {
                                        create: ground.settings
                                    }
                                }
                            });
                        };

                        // Re-insert fresh combinations
                        for (const combination of data.combinations) {
                            await tx.combination.create({
                                data: {
                                    ...combination,
                                    layoutId: layout.id,
                                    grounds: {
                                        connect: combination.grounds.map((id) => ({ id }))
                                    },
                                    settings: {
                                        create: combination.settings
                                    }
                                }
                            });
                        };

                        return layout;
                    });

                    return res.status(200).json({ message: "Updated pitch draft layout successfully.", data: result });
                }
            case "SCHEDULE":
                {
                    const schema = scheduleSchema;

                    const parsed = schema.safeParse(Object.values(req.body.data));
                    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message, path: parsed.error.issues[0].path });
                    if (!draft) return res.status(400).json({ message: "Could not find an existing pitch draft to update. Please create a new pitch draft." });
                    
                    const data = parsed.data;

                    const result = await prisma.$transaction(async (tx) => {
                        for (const schedule of data) {
                            await tx.schedule.create({
                                data: {
                                    pitchId: draft.id,
                                    ...schedule
                                }
                            })
                        };

                        await tx.pitch.update({
                            where: {
                                id: draft.id
                            },
                            data: {
                                status: "PENDING"
                            }
                        })
                    });

                    return res.status(200).json({ message: "Created pitch draft schedule successfully! Changed status to pending.", data: result });
                }
        };

        return res.status(400).json({ message: "No changes were made to the pitch draft." });
    } catch (error: any) {
        return res.status(500).json({ message: "A server-side error occurred while creating a new pitch draft.", error: error.message });
    }
};

export async function fetchPitches(req: Request, res: Response, next: NextFunction) {
    const id = req.user?.sub;

    if (!id) return res.status(403).json({ message: "Could not fetch user associated pitches. Please sign in and try again." });

    const today = new Date().getDay();
    const tomorrow = (today + 1) % 7;

    const pitches = await prisma.pitch.findMany({
        where: {
            status: { notIn: ["DRAFT", "SUSPENDED", "DELETED", "REJECTED"] },
            OR: [
                { 
                    owner: { 
                        userId: id 
                    } 
                },
                { 
                    permissions: { 
                        some: { 
                            manager: { 
                                user: {
                                    id
                                }
                            }
                        }
                    } 
                }
            ]
        },
        select: {
            id: true,
            name: true,
            status: true,
            street: true,
            area: true,
            city: true,
            country: true,
            googleMapsLink: true,
            layout: {
                select: { grounds: true, combinations: true }
            },
            schedule: {
                where: {
                    dayOfWeek: {
                        in: [today, tomorrow]
                    }
                },
                select: {
                    dayOfWeek: true,
                    openTime: true,
                    closeTime: true
                }
            },
            owner: {
                select: {
                    userId: true
                },
            },
            permissions: {
                select: {
                    manager: {
                        select: {
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!pitches) return res.status(404).json({ message: "Could not find any working pitches for the specified user ID. Please make sure you have at least one actve pitch and try again." });

    const updated = pitches.map(pitch => {
        if (pitch.owner.userId === id) {
            return { ...pitch, role: "Owner" }
        };

        if (pitch.permissions.some(item => item.manager.user.id === id)) {
            return { ...pitch, role: "Manager" }
        };
    });

    return res.status(200).json({ message: "Fetched owner pitches successfully.", data: updated ?? [] });
}