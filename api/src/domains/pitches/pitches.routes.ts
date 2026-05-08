import { Hono } from "hono";

import { 
    createPitchHandler, 
    getPitchHandler, 
    createGroundHandler, 
    getGroundHandler, 
    getGroundsHandler, 
    updateGroundHandler,
    getGroundSettingsHandler,
    updateGroundSettingsHandler,
    upsertGroundScheduleHandler,
    fetchGroundScheduleHandler,
    fetchGroundSchedulesHandler,
    getPitchAmenityHandler,
    getPitchAmenitiesHandler,
    createPitchAmenityHandler,
    updatePitchAmenityHandler,
    deletePitchAmenityHandler,
    createPitchMediaPresignLinkHandler,
    confirmPitchMediaUploadHandler,
    submitPitchHandler,
    updatePitchHandler,
    createPitchInvitationHandler,
    fetchPitchInvitationHandler,
    deletePitchInvitationHandler,
    acceptPitchInvitationHandler,
    rejectPitchInvitationHandler,
    fetchPitchStaffHandler,
    fetchPitchStaffMemberHandler,
    updatePitchStaffMemberHandler,
    deletePitchStaffMemberHandler
} from "@/domains/pitches/pitches.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createPitchHandler)
    .get('/:pitchId', ...getPitchHandler)
    .patch('/:pitchId', ...updatePitchHandler)
    .get('/:pitchId/amenities', ...getPitchAmenitiesHandler)
    .post('/:pitchId/amenities', ...createPitchAmenityHandler)
    .get('/:pitchId/amenities/:order', ...getPitchAmenityHandler)
    .patch('/:pitchId/amenities/:order', ...updatePitchAmenityHandler)
    .delete('/:pitchId/amenities/:order', ...deletePitchAmenityHandler)
    .post('/:pitchId/grounds', ...createGroundHandler)
    .get('/:pitchId/grounds/:groundId', ...getGroundHandler)
    .get('/:pitchId/grounds', ...getGroundsHandler)
    .patch('/:pitchId/grounds/:groundId', ...updateGroundHandler)
    .get('/:pitchId/grounds/:groundId/settings', ...getGroundSettingsHandler)
    .patch('/:pitchId/grounds/:groundId/settings', ...updateGroundSettingsHandler)
    .get('/:pitchId/grounds/:groundId/schedule', ...fetchGroundSchedulesHandler)
    .put('/:pitchId/grounds/:groundId/schedule/:dayOfWeek', ...upsertGroundScheduleHandler)
    .get('/:pitchId/grounds/:groundId/schedule/:dayOfWeek', ...fetchGroundScheduleHandler)
    .post('/:pitchId/media/presign', ...createPitchMediaPresignLinkHandler)
    .post('/:pitchId/media/:mediaId/confirm', ...confirmPitchMediaUploadHandler)
    .post('/:pitchId/submit', ...submitPitchHandler)
    .post('/:pitchId/team/invitations', ...createPitchInvitationHandler)
    .get('/:pitchId/team/invitations/:invitationId', ...fetchPitchInvitationHandler)
    .delete('/:pitchId/team/invitations/:invitationId', ...deletePitchInvitationHandler)
    .post('/:pitchId/team/invitations/:invitationId/accept', ...acceptPitchInvitationHandler)
    .post('/:pitchId/team/invitations/:invitationId/reject', ...rejectPitchInvitationHandler)
    .get('/:pitchId/team', ...fetchPitchStaffHandler)
    .get('/:pitchId/team/:memberId', ...fetchPitchStaffMemberHandler)
    .patch('/:pitchId/team/:memberId', ...updatePitchStaffMemberHandler)
    .delete('/:pitchId/team/:memberId', ...deletePitchStaffMemberHandler)

export default app;
export type AppType = typeof app;
