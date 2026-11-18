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
// Admin support on a venue's team (the admin is the actor, with their reason): a member taken off the
// staff, and the venue handed to another member. The data names the people involved.
export const STAFF_REMOVED = "STAFF_REMOVED";
export const OWNERSHIP_TRANSFERRED = "OWNERSHIP_TRANSFERRED";
// A staff account suspended or reactivated by an admin. Account-wide, so it's recorded on every venue
// they're a member of, where each venue's admins look.
export const STAFF_SUSPENDED = "STAFF_SUSPENDED";
export const STAFF_REACTIVATED = "STAFF_REACTIVATED";
// Banned for good by an admin, recorded the same way.
export const STAFF_BANNED = "STAFF_BANNED";

// The venue's lifecycle (docs/onboarding.md): the owner is the actor when creating it.
export const VENUE_CREATED = "VENUE_CREATED";
// Edits during setup and after going live, each with the previous and new values so admins can audit
// them (and revert, later).
export const VENUE_DETAILS_CHANGED = "VENUE_DETAILS_CHANGED";
export const VENUE_LOCATION_CHANGED = "VENUE_LOCATION_CHANGED";
// An admin setting the area, usually the one the owner asked for when Hagz didn't cover it.
export const VENUE_AREA_SET = "VENUE_AREA_SET";
export const VENUE_TRANSLATION_CHANGED = "VENUE_TRANSLATION_CHANGED";
export const VENUE_SETTINGS_CHANGED = "VENUE_SETTINGS_CHANGED";
// An admin set or cleared the venue's commission override.
export const VENUE_COMMISSION_CHANGED = "VENUE_COMMISSION_CHANGED";
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
// The layout, saved whole.
export const VENUE_LAYOUT_CHANGED = "VENUE_LAYOUT_CHANGED";
// The venue's lifecycle (docs/onboarding.md): submitted and withdrawn by the owner, reviewed and
// taken live by an admin, paused and resumed by either.
export const VENUE_SUBMITTED = "VENUE_SUBMITTED";
export const VENUE_WITHDRAWN = "VENUE_WITHDRAWN";
export const VENUE_APPROVED = "VENUE_APPROVED";
export const VENUE_REJECTED = "VENUE_REJECTED";
export const VENUE_LIVE = "VENUE_LIVE";
export const VENUE_PAUSED = "VENUE_PAUSED";
export const VENUE_RESUMED = "VENUE_RESUMED";
export const TAX_NUMBER_CHECKED = "TAX_NUMBER_CHECKED";
export const LIFECYCLE_EVENTS = [VENUE_SUBMITTED, VENUE_WITHDRAWN, VENUE_REJECTED, VENUE_APPROVED];

// Staff changing slots (PR 2.6), each with the slots' ids and what they did to them.
export const SLOTS_BLOCKED = "SLOTS_BLOCKED";
export const SLOTS_UNBLOCKED = "SLOTS_UNBLOCKED";
export const SLOT_PRICES_SET = "SLOT_PRICES_SET";
export const SLOTS_ADDED = "SLOTS_ADDED";
export const SLOTS_RESET = "SLOTS_RESET";
