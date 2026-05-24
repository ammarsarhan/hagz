import { InvitationStatus, NotificationEvent, PermissionLevel, PitchStatus, StaffRole, UserStatus } from "@/generated/prisma/enums.js";
import { BadRequestError, ERROR_CODES, ForbiddenError, InternalServerError, NotFoundError, UnauthorizedError } from "@/shared/lib/utils/error.js";
import prisma from "@/shared/lib/utils/prisma.js";
import type { CreateInvitationPayloadType, UpdatePitchStaffMemberPayloadType } from "@/domains/pitches/pitches.validator.js";
import config from "@/shared/config.js";
import { randomUUID } from "crypto";
import type { Permissions } from "@/shared/types/staff.js";
import NotificationsService from "@/domains/notifications/notifications.service.js";
import { differenceInMilliseconds } from "date-fns";
import { invitationsQueue } from "@/jobs/queues/invitations.queue.js";
import { formatInTimeZone } from "date-fns-tz";

export default class StaffService {
    // Helper function that returns default permissions per domain.
    private readonly createDefaultPermissions = () => ({
        settings: PermissionLevel.READ,
        schedule: PermissionLevel.WRITE,
        bookings: PermissionLevel.WRITE,
        analytics: PermissionLevel.READ,
        payments: PermissionLevel.READ,
        layout: PermissionLevel.READ,
        team: PermissionLevel.READ,
        properties: PermissionLevel.READ
    } as Permissions);

    // Helper function to add/remove the invitation to the queue to auto-expire.
    private readonly enqueueInvitationExpiry = async (invitationId: string, pitchId: string, expiresAt: Date) => {
        // Math.max to ensure that any delays that bypass get passed as 0 rather than negatives.
        const delay = Math.max(0, differenceInMilliseconds(expiresAt, new Date()));
        await invitationsQueue.add(
            "expire", 
            { invitationId, pitchId },
            { delay, attempts: 3, jobId: `invitation-${invitationId}-expire` }
        );
    } 

    private readonly dequeueInvitationExpiry = async (invitationId: string) => {
        await invitationsQueue.remove(`invitation-${invitationId}-expire`);
    };

    createInvitation = async (pitchId: string, creatorId: string, payload: CreateInvitationPayloadType) => {
        // Find pitch and ensure that it is not deleted.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Make sure that it is active to start adding staff to it.
        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not send invitation on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Make sure the phone number does not exist with either an invitation or a staff member on the pitch already.
        const user = await prisma.user.findUnique({
            where: {
                phone: payload.phone,
                pitches: {
                    some: {
                        pitchId,
                        deletedAt: null
                    }
                }
            }
        });

        if (user) throw new BadRequestError("User with the specified phone number already exists as a staff member on the pitch. Can not create invitation.", ERROR_CODES.PITCH_STAFF_ALREADY_EXISTS);

        const invitation = await prisma.invitation.findFirst({ 
            where: { 
                pitchId, 
                phone: payload.phone, 
                status: InvitationStatus.PENDING 
            }
        });

        if (invitation) throw new BadRequestError("User with the specified phone number already has an invitation for the pitch. Can not create invitation.", ERROR_CODES.PITCH_INVITATION_ALREADY_EXISTS);

        // Create the actual invitation record in the database and store the event in the event log.
        const token = randomUUID();

        const data = await prisma.$transaction(async tx => {
            const invitation = await tx.invitation.create({
                data: {
                    pitchId,
                    creatorId,
                    token,
                    ...payload
                }
            });

            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    actorId: creatorId,
                    status: pitch.status,
                    reason: `Created an invitation on the pitch for ${payload.phone}.`
                }
            });

            return invitation;
        });

        // Call the notifications service to send out the deliveries.
        await this.enqueueInvitationExpiry(data.id, pitch.id, data.expiresAt);

        const owner = await prisma.staff.findFirst({ 
            where: {
                pitchId,
                role: StaffRole.OWNER
            },
            include: { 
                user: true
            }
        });

        if (!owner)
            throw new InternalServerError("Could not resolve pitch owner.");

        const actor = await prisma.user.findUnique({ where: { id: creatorId, status: { not: UserStatus.DELETED } }, include: { preferences: true } });
        if (!actor) throw new InternalServerError("Could not find user account after creating invitation.");
        if (!actor.preferences) throw new InternalServerError("Could not resolve preferences associated with the user account.");

        // Dispatch the owner's notification first because it has a higher priority.
        await NotificationsService.createNotification({ 
            phone: owner.user.phone, 
            event: NotificationEvent.INVITATION_CREATED,
            data: {
                receiverName: actor.firstName,
                actorName: payload.name,
                action: "added as a staff manager by invitation",
                pitchName: pitch.name,
                phone: payload.phone,
                expiresAt: formatInTimeZone(data.expiresAt, actor.preferences.timezone, "d-M-yyyy 'at' h aa")
            },
        });

        // Then dispatch the recipient's message.
        await NotificationsService.createNotification({ 
            phone: payload.phone, 
            event: NotificationEvent.INVITATION_RECEIVED,
            data: {
                receiverName: payload.name,
                actorName: actor.firstName,
                pitchName: pitch.name,
                deepLink: `https://www.hagz.com/invitation/${data.id}`,
                expiresAt: formatInTimeZone(data.expiresAt, actor.preferences.timezone, "d-M-yyyy 'at' h aa")
            },
        });

        return data;
    };

    fetchInvitations = async (pitchId: string) => {
        // Find pitch and ensure that it is not deleted.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Make sure that the pitch is both active and we are fetching any "un-deleted" invitations.
        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not fetch invitations on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);

        const invitations = await prisma.invitation.findMany({
            where: {
                pitchId,
                status: { not: InvitationStatus.DELETED }
            }
        });

        return invitations;
    };

    deleteInvitation = async (pitchId: string, invitationId: string) => {
        // Make sure that the pitch is in a state to delete invitations.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            select: { status: true }
        });
        
        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not delete invitation on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Make sure the invitation exists and is pending or expired. We don't want to delete any invitations that are accepted or rejected.
        const invitation = await prisma.invitation.findUnique({
            where: {
                id: invitationId,
                pitchId,
                status: { in: [InvitationStatus.PENDING, InvitationStatus.EXPIRED] }
            }
        });

        if (!invitation)
            throw new BadRequestError("Could not find pending or expired invitation with the specified ID. Please make sure the invitation has not been accepted or rejected yet.", ERROR_CODES.PITCH_INVITATION_NOT_PENDING);

        // If it passes the check, update its status to DELETED and dequeue it if it's still awaiting expiry.
        await prisma.invitation.update({
            where: { 
                id: invitationId,
                pitchId
            },
            data: {
                status: InvitationStatus.DELETED
            }
        });

        await this.dequeueInvitationExpiry(invitationId);
    };

    acceptPitchInvitation = async (userId: string, pitchId: string, invitationId: string) => {
        // Make sure that the pitch is in a state to accept new users.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            select: { status: true }
        });
        
        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not accept invitation on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);
        
        // Make sure that the user is in a state to be added to the pitch.
        const user = await prisma.user.findUnique({ where: { id: userId, status: { not: UserStatus.DELETED } }, include: { pitches: true } });
        
        if (!user) throw new NotFoundError("Could not find user with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);
        if (user.status != UserStatus.ACTIVE) throw new ForbiddenError("User account is not active. You are not allowed to accept this invitation.", ERROR_CODES.USER_NOT_ACTIVE);
        if (user.pitches.find(item => item.pitchId === pitchId && item.deletedAt === null)) throw new BadRequestError("User already exists with a role on the specified pitch. Can not accept invitation.", ERROR_CODES.PITCH_STAFF_ALREADY_EXISTS);

        // Make sure that the invitation is still pending and has not expired yet.
        const invitation = await prisma.invitation.findUnique({ 
            where: {
                id: invitationId,
                status: InvitationStatus.PENDING,
                acceptedAt: null,
                rejectedAt: null,
                expiresAt: { gt: new Date() }
            }
        });

        if (!invitation) throw new BadRequestError("No pending invitation with the specified ID has been found. Please request one from the pitch owner or a user with permissions.", ERROR_CODES.PITCH_INVITATION_NOT_PENDING);
        if (invitation.phone !== user.phone) throw new UnauthorizedError("You are not authorized to perform this action. Please sign in as the target user behind the invitation before accepting it.", ERROR_CODES.UNAUTHORIZED);

        // Add their record as a manager on the Staff table with the default permissions for a manager member on a pitch.
        const permissions = this.createDefaultPermissions();

        // Wrap it in a transaction to ensure that both get updated atomically.
        const staff = await prisma.$transaction(async tx => {
            // Convert this to an upsert rather than a create to ensure that soft-deleted accounts get reactivated normally without hitting the unique constraint.
            const staff = await tx.staff.upsert({
                where: { 
                    userId_pitchId: { 
                        userId, 
                        pitchId 
                    } 
                },
                create: {
                    pitchId,
                    userId,
                    role: StaffRole.MANAGER,
                    permissions
                },
                update: {
                    role: StaffRole.MANAGER,
                    permissions,
                    deletedAt: null
                }
            });

            await tx.invitation.update({ 
                where: {
                    id: invitationId
                },
                data: {
                    status: InvitationStatus.ACCEPTED,
                    acceptedAt: new Date()
                }
            });

            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    actorId: userId,
                    status: pitch.status,
                    reason: `Accepted an invitation on the pitch for ${user.phone}.`
                }
            });

            return staff;
        });

        // Remove the expiration job from the queue and return the new staff role.
        await this.dequeueInvitationExpiry(invitation.id);
        return staff;
    };

    rejectPitchInvitation = async (userId: string, pitchId: string, invitationId: string) => {
        // Make sure that the pitch is in a state to reject invitations.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            select: { status: true }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not reject invitation on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);
        
        // Make sure that the user is in a state to be added to the pitch.
        const user = await prisma.user.findUnique({ where: { id: userId, status: { not: UserStatus.DELETED } }, include: { pitches: true } });
        
        if (!user) throw new NotFoundError("Could not find user with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);
        if (user.status != UserStatus.ACTIVE) throw new ForbiddenError("User account is not active. You are not allowed to accept this invitation.", ERROR_CODES.USER_NOT_ACTIVE);
        if (user.pitches.find(item => item.pitchId === pitchId && item.deletedAt === null)) throw new BadRequestError("User already exists with a role on the specified pitch. Can not reject invitation.", ERROR_CODES.PITCH_STAFF_ALREADY_EXISTS);

        // Make sure that the invitation is still pending and has not expired yet.
        const invitation = await prisma.invitation.findUnique({ 
            where: {
                id: invitationId,
                status: InvitationStatus.PENDING,
                acceptedAt: null,
                rejectedAt: null,
                expiresAt: { gt: new Date() }
            }
        });

        if (!invitation) throw new BadRequestError("No pending invitation with the specified ID has been found. Please request one from the pitch owner or a user with permissions.", ERROR_CODES.PITCH_INVITATION_NOT_PENDING);
        if (invitation.phone !== user.phone) throw new UnauthorizedError("You are not authorized to perform this action. Please sign in as the target user behind the invitation before rejecting it.", ERROR_CODES.UNAUTHORIZED);

        // Update the invitation to reject, remove the job, and return the updated invitation.
        const data = await prisma.invitation.update({
            where: {
                id: invitationId
            },
            data: {
                status: InvitationStatus.REJECTED,
                rejectedAt: new Date()
            }
        });

        await this.dequeueInvitationExpiry(invitation.id);
        return data;
    };

    // Separate functions for team and member because they return different data types. This is a cleaner pattern.
    fetchStaff = async (pitchId: string) => {
        // Make sure that the pitch is in a state to fetch staff.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            select: { status: true }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Get all the staff associated with this pitchId that have not been deleted and return.
        const staff = await prisma.staff.findMany({
            where: { 
                pitchId,
                deletedAt: null
            }
        });

        return staff;
    };

    fetchStaffMember = async (pitchId: string, memberId: string) => {
        // Make sure that the pitch is in a state to fetch staff.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            select: { status: true }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        // Get all the staff associated with this pitchId that have not been deleted and return.
        const staff = await prisma.staff.findUnique({
            where: { 
                userId_pitchId: {
                    userId: memberId,
                    pitchId
                },
                deletedAt: null
            }
        });

        if (!staff) 
            throw new NotFoundError("Could not find staff with the specified ID.", ERROR_CODES.PITCH_STAFF_NOT_FOUND);

        return staff;
    };

    updateStaffMember = async (pitchId: string, memberId: string, payload: UpdatePitchStaffMemberPayloadType, userId: string) => {
        // Make sure that the pitch is in a state to delete the staff member.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            select: { status: true }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not update staff on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Fetch the staff record, make sure that they are not updating themselves or an owner, and make sure they are in an updatable state.
        const staff = await prisma.staff.findUnique({
            where: {
                userId_pitchId: {
                    userId: memberId,
                    pitchId
                },
                deletedAt: null
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (!staff)
            throw new NotFoundError("Could not find staff with the specified ID.", ERROR_CODES.PITCH_STAFF_NOT_FOUND);

        if (memberId === userId)
            throw new BadRequestError("A user may not update themselves on a pitch staff registry. Please ask a user with enough privleges to commit this action.", ERROR_CODES.VALIDATION_FAILED);

        if (staff.role === StaffRole.OWNER)
            throw new BadRequestError("Can not update an owner from the pitch staff registry. If this is an intended action, contact the owner to transfer ownership first.", ERROR_CODES.VALIDATION_FAILED);

        return await prisma.$transaction(async tx => {
            // Extract the permissions from the payload.
            const permissions = payload.permissions;

            const updated = await tx.staff.update({
                where: {
                    userId_pitchId: {
                        userId: memberId,
                        pitchId
                    }
                },
                data: { permissions }
            });

            // Log the changes in the PitchEvent table to keep track of privlege escalation.
            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    actorId: userId,
                    status: pitch.status,
                    reason: `Updated staff member ${staff.user.firstName} ${staff.user.lastName}'s permissions.`
                }
            });

            return updated;
        })
    }

    deleteStaffMember = async (pitchId: string, memberId: string, userId: string) => {
        // Make sure that the pitch is in a state to delete the staff member.
        const pitch = await prisma.pitch.findUnique({ 
            where: {
                id: pitchId,
                status: { not: PitchStatus.DELETED }
            },
            select: { status: true }
        });

        if (!pitch) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        if (!config.ACTIVE_STATES.includes(pitch.status))
            throw new BadRequestError("Pitch is not active. Can not delete staff on an inactive pitch.", ERROR_CODES.PITCH_NOT_ACTIVE);

        // Make sure that the user is not deleting themselves, deleting an account that has already been deleted, or deleting an owner.
        if (memberId === userId)
            throw new BadRequestError("A user may not delete themselves from a pitch staff registry. Please ask a user with enough privleges to commit this action.", ERROR_CODES.VALIDATION_FAILED);

        const staff = await prisma.staff.findUnique({
            where: {
                userId_pitchId: {
                    userId: memberId,
                    pitchId
                },
                deletedAt: null
            }
        });

        if (!staff)
            throw new NotFoundError("Could not find staff record with the specified ID under the requested pitch.", ERROR_CODES.PITCH_STAFF_NOT_FOUND);

        if (staff.role === StaffRole.OWNER)
            throw new BadRequestError("Can not remove an owner from the pitch staff registry. If this is an intended action, contact the owner to transfer ownership first.", ERROR_CODES.VALIDATION_FAILED);

        // If we pass the checks, update the staff record to soft-delete the user from the pitch.
        const updated = await prisma.$transaction(async tx => {
            const staff = await tx.staff.update({
                where: {
                    userId_pitchId: {
                        userId: memberId,
                        pitchId
                    },
                },
                data: {
                    deletedAt: new Date()
                },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });

            await tx.invitation.updateMany({
                where: { pitchId, creatorId: memberId, status: InvitationStatus.PENDING },
                data: { status: InvitationStatus.DELETED }
            });

            await tx.pitchEvent.create({
                data: {
                    pitchId,
                    actorId: userId,
                    status: pitch.status,
                    reason: `Deleted staff member ${staff.user.firstName} ${staff.user.lastName} from the pitch.`
                }
            });
            
            return staff;
        })

        return updated;
    }
}