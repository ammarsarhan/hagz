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
