import { Hono } from "hono";

import { createPitchHandler, submitPitchHandler, updatePitchHandler, fetchPitchAvailabilityHandler, publishPitchHandler, deactivatePitchHandler, getDashboardPitchHandler } from "@/domains/pitches/handlers/pitches.handlers.js";
import { createGroundHandler, deactivateGroundHandler, activateGroundHandler, fetchGroundScheduleHandler, fetchGroundSchedulesHandler, fetchGroundSlotHandler, fetchGroundSlotsHandler, getGroundHandler, deleteGroundHandler, getGroundSettingsHandler, getGroundsHandler, updateGroundHandler, updateGroundSettingsHandler, updateGroundSlotHandler, upsertGroundScheduleHandler, getStaffBookingsHandler, getStaffBookingHandler } from "@/domains/pitches/handlers/grounds.handlers.js";
import { createPitchAmenityHandler, deletePitchAmenityHandler, getPitchAmenitiesHandler, getPitchAmenityHandler, updatePitchAmenityHandler } from "@/domains/pitches/handlers/amenities.handlers.js";
import { confirmPitchMediaUploadHandler, createPitchMediaPresignLinkHandler, deletePitchMediaHandler, fetchPitchMediaHandler } from "@/domains/pitches/handlers/media.handlers.js";
import { acceptPitchInvitationHandler, createPitchInvitationHandler, deletePitchInvitationHandler, deletePitchStaffMemberHandler, fetchPitchInvitationHandler, fetchPitchStaffHandler, fetchPitchStaffMemberHandler, rejectPitchInvitationHandler, updatePitchStaffMemberHandler } from "@/domains/pitches/handlers/staff.handlers.js";
import { createStaffBookingHandler } from "@/domains/bookings/bookings.handlers.js";

// Chained for RPC type support on the frontend.
const app = new Hono()
    .post('/', ...createPitchHandler)
    .get('/:pitchId', ...getDashboardPitchHandler)
    .patch('/:pitchId', ...updatePitchHandler)
    .get('/:pitchId/amenities', ...getPitchAmenitiesHandler)
    .post('/:pitchId/amenities', ...createPitchAmenityHandler)
    .get('/:pitchId/amenities/:order', ...getPitchAmenityHandler)
    .patch('/:pitchId/amenities/:order', ...updatePitchAmenityHandler)
    .delete('/:pitchId/amenities/:order', ...deletePitchAmenityHandler)
    .post('/:pitchId/grounds', ...createGroundHandler)
    .get('/:pitchId/grounds/:groundId', ...getGroundHandler)
    .delete('/:pitchId/grounds/:groundId', ...deleteGroundHandler)
    .get('/:pitchId/grounds', ...getGroundsHandler)
    .patch('/:pitchId/grounds/:groundId', ...updateGroundHandler)
    .get('/:pitchId/grounds/:groundId/settings', ...getGroundSettingsHandler)
    .patch('/:pitchId/grounds/:groundId/settings', ...updateGroundSettingsHandler)
    .get('/:pitchId/grounds/:groundId/schedule', ...fetchGroundSchedulesHandler)
    .put('/:pitchId/grounds/:groundId/schedule/:dayOfWeek', ...upsertGroundScheduleHandler)
    .get('/:pitchId/grounds/:groundId/schedule/:dayOfWeek', ...fetchGroundScheduleHandler)
    .post('/:pitchId/grounds/:groundId/deactivate', ...deactivateGroundHandler)
    .post('/:pitchId/grounds/:groundId/activate', ...activateGroundHandler)
    .post('/:pitchId/grounds/:groundId/bookings', ...createStaffBookingHandler)
    .get('/:pitchId/grounds/:groundId/bookings', ...getStaffBookingsHandler)
    .get('/:pitchId/grounds/:groundId/bookings/:bookingId', ...getStaffBookingHandler)
    .get('/:pitchId/grounds/:groundId/slots', ...fetchGroundSlotsHandler)
    .get('/:pitchId/grounds/:groundId/slots/:slotId', ...fetchGroundSlotHandler)
    .patch('/:pitchId/grounds/:groundId/slots/:slotId', ...updateGroundSlotHandler)
    .post('/:pitchId/media/presign', ...createPitchMediaPresignLinkHandler)
    .post('/:pitchId/media/:mediaId/confirm', ...confirmPitchMediaUploadHandler)
    .get('/:pitchId/media', ...fetchPitchMediaHandler)
    .delete('/:pitchId/media/:mediaId', ...deletePitchMediaHandler)
    .post('/:pitchId/submit', ...submitPitchHandler)
    .post('/:pitchId/deactivate', ...deactivatePitchHandler)
    .post('/:pitchId/publish', ...publishPitchHandler)
    .post('/:pitchId/team/invitations', ...createPitchInvitationHandler)
    .get('/:pitchId/team/invitations/:invitationId', ...fetchPitchInvitationHandler)
    .delete('/:pitchId/team/invitations/:invitationId', ...deletePitchInvitationHandler)
    .post('/:pitchId/team/invitations/:invitationId/accept', ...acceptPitchInvitationHandler)
    .post('/:pitchId/team/invitations/:invitationId/reject', ...rejectPitchInvitationHandler)
    .get('/:pitchId/team', ...fetchPitchStaffHandler)
    .get('/:pitchId/team/:memberId', ...fetchPitchStaffMemberHandler)
    .patch('/:pitchId/team/:memberId', ...updatePitchStaffMemberHandler)
    .delete('/:pitchId/team/:memberId', ...deletePitchStaffMemberHandler)
    .get('/:pitchId/availability', ...fetchPitchAvailabilityHandler)

export default app;
export type AppType = typeof app;
