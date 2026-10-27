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
