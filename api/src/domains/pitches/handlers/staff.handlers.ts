import validate from "@/shared/middleware/validate.middleware.js";
import guard from "@/domains/pitches/pitches.middleware.js";
import StaffService from "@/domains/pitches/services/staff.service.js";
import { createFactory } from "hono/factory";
import { PermissionLevel } from "@/generated/prisma/enums.js";
import { createInvitationSchema, updatePitchStaffMemberSchema } from "@/domains/pitches/pitches.validator.js";
import { ERROR_CODES, NotFoundError } from "@/shared/lib/utils/error.js";
import { authorize } from "@/domains/auth/auth.middleware.js";

const factory = createFactory();
const staffService = new StaffService();

export const createPitchInvitationHandler = factory.createHandlers(
    guard("team", PermissionLevel.WRITE),
    validate("json", createInvitationSchema),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");
        const payload = c.req.valid("json");
        
        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const invitation = await staffService.createInvitation(pitchId, userId, payload);
        return c.json({ success: true, data: { invitation }}, 201);
    }
);

export const fetchPitchInvitationHandler = factory.createHandlers(
    guard("team", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const invitations = await staffService.fetchInvitations(pitchId);
        return c.json({ success: true, data: { invitations }}, 201);
    }
);

export const deletePitchInvitationHandler = factory.createHandlers(
    guard("team", PermissionLevel.WRITE),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const invitationId = c.req.param("invitationId");

        if (!pitchId || !invitationId) 
            throw new NotFoundError("Could not find invitation with the specified ID.", ERROR_CODES.PITCH_INVITATION_NOT_FOUND);

        await staffService.deleteInvitation(pitchId, invitationId);
        return c.json({ success: true, data: null }, 201);
    }
);

export const acceptPitchInvitationHandler = factory.createHandlers(
    authorize(),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");
        const invitationId = c.req.param("invitationId");

        if (!pitchId || !invitationId) 
            throw new NotFoundError("Could not find invitation with the specified ID.", ERROR_CODES.PITCH_INVITATION_NOT_FOUND);

        const staff = await staffService.acceptPitchInvitation(userId, pitchId, invitationId);

        return c.json({ success: true, data: { staff } }, 200);
    }
);

export const rejectPitchInvitationHandler = factory.createHandlers(
    authorize(),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");
        const invitationId = c.req.param("invitationId");

        if (!pitchId || !invitationId) 
            throw new NotFoundError("Could not find invitation with the specified ID.", ERROR_CODES.PITCH_INVITATION_NOT_FOUND);

        const staff = await staffService.rejectPitchInvitation(userId, pitchId, invitationId);

        return c.json({ success: true, data: { staff } }, 200);
    }
);

export const fetchPitchStaffHandler = factory.createHandlers(
    guard("team", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");

        if (!pitchId) 
            throw new NotFoundError("Could not find pitch with the specified ID.", ERROR_CODES.PITCH_NOT_FOUND);

        const staff = await staffService.fetchStaff(pitchId);

        return c.json({ success: true, data: { staff } }, 200); 
    }
);

export const fetchPitchStaffMemberHandler = factory.createHandlers(
    guard("team", PermissionLevel.READ),
    async (c) => {
        const pitchId = c.req.param("pitchId");
        const memberId = c.req.param("memberId");

        if (!pitchId || !memberId) 
            throw new NotFoundError("Could not find member with the specified ID.", ERROR_CODES.PITCH_STAFF_NOT_FOUND);

        const staff = await staffService.fetchStaffMember(pitchId, memberId);

        return c.json({ success: true, data: { staff } }, 200); 
    }
);

export const updatePitchStaffMemberHandler = factory.createHandlers(
    guard("team", PermissionLevel.WRITE),
    validate("json", updatePitchStaffMemberSchema),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");
        const memberId = c.req.param("memberId");
        const payload = c.req.valid("json");

        if (!pitchId || !memberId) 
            throw new NotFoundError("Could not find member with the specified ID.", ERROR_CODES.PITCH_STAFF_NOT_FOUND);

        const staff = await staffService.updateStaffMember(pitchId, memberId, payload, userId);

        return c.json({ success: true, data: { staff } }, 200); 
    }
);

export const deletePitchStaffMemberHandler = factory.createHandlers(
    guard("team", PermissionLevel.WRITE),
    async (c) => {
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");
        const memberId = c.req.param("memberId");

        if (!pitchId || !memberId) 
            throw new NotFoundError("Could not find member with the specified ID.", ERROR_CODES.PITCH_STAFF_NOT_FOUND);

        await staffService.deleteStaffMember(pitchId, memberId, userId);
        
        return c.json({ success: true, data: null }, 200); 
    }
);
