// VenueEvent types this module writes. `staffId` on the event is whoever acted; `memberId` in the data
// is whose permissions changed (the same person after a password reset).
export const PERMISSIONS_CHANGED = "STAFF_PERMISSIONS_CHANGED";
export const RESTRICTED_AFTER_PASSWORD_RESET = "STAFF_RESTRICTED_AFTER_PASSWORD_RESET";

export const PERMISSION_EVENTS = [PERMISSIONS_CHANGED, RESTRICTED_AFTER_PASSWORD_RESET];

export interface PermissionEventData {
  memberId: string;
  previousPermissions: unknown;
  permissions: unknown;
}

// Invitations: the inviter, the revoker, or the invitee (accepting or declining) is the actor.
export const STAFF_INVITED = "STAFF_INVITED";
export const STAFF_INVITATION_REVOKED = "STAFF_INVITATION_REVOKED";
export const STAFF_INVITATION_DECLINED = "STAFF_INVITATION_DECLINED";
export const STAFF_JOINED = "STAFF_JOINED";

// The venue's lifecycle (docs/onboarding.md): the owner is the actor when creating it.
export const VENUE_CREATED = "VENUE_CREATED";
// Edits during setup and after going live, each with the previous and new values so admins can audit
// them (and revert, later).
export const VENUE_DETAILS_CHANGED = "VENUE_DETAILS_CHANGED";
export const VENUE_LOCATION_CHANGED = "VENUE_LOCATION_CHANGED";
export const VENUE_TRANSLATION_CHANGED = "VENUE_TRANSLATION_CHANGED";
export const VENUE_SETTINGS_CHANGED = "VENUE_SETTINGS_CHANGED";
export const VENUE_AMENITIES_CHANGED = "VENUE_AMENITIES_CHANGED";
// Photos: added when an upload is confirmed.
export const VENUE_PHOTO_ADDED = "VENUE_PHOTO_ADDED";
export const VENUE_PHOTO_REMOVED = "VENUE_PHOTO_REMOVED";
export const VENUE_PHOTOS_REORDERED = "VENUE_PHOTOS_REORDERED";
// Grounds and their weekly hours.
export const GROUND_ADDED = "GROUND_ADDED";
export const GROUND_CHANGED = "GROUND_CHANGED";
export const GROUND_REMOVED = "GROUND_REMOVED";
export const GROUNDS_REORDERED = "GROUNDS_REORDERED";
export const GROUND_SCHEDULE_CHANGED = "GROUND_SCHEDULE_CHANGED";
export const GROUND_SCHEDULE_COPIED = "GROUND_SCHEDULE_COPIED";
