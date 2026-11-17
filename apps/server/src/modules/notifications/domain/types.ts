// Every notification type, with the template data it carries. Text is rendered from these in the
// recipient's language when it's sent; deep links are derived from the type and its context.
export interface NotificationData {
  // A member of the venue reset their password and was made read-only there. `eventId` is the
  // VenueEvent holding their previous permissions, for "restore".
  STAFF_PASSWORD_RESET: { staffId: string; eventId: string };
  // Someone with an account was invited to a venue's staff; opens their invitations.
  STAFF_INVITED: { invitationId: string };
  // An invitation was accepted: tells the venue's staff managers who joined.
  STAFF_JOINED: { staffId: string };
  // An admin took them off a venue's staff; the venue leaves their list.
  STAFF_REMOVED: Record<string, never>;
  // An admin made another member the owner. To both: the new owner, and the old one (now a member).
  OWNERSHIP_TRANSFERRED: { fromStaffId: string; toStaffId: string };
  // The venue's review (docs/onboarding.md, step 3). To admins: an owner sent a venue for review.
  VENUE_SUBMITTED: { submittedBy: string };
  // To the owner: approved (now provisioning), sent back with a reason, or live.
  VENUE_APPROVED: Record<string, never>;
  VENUE_REJECTED: { reason: string };
  VENUE_LIVE: Record<string, never>;
}

export type NotificationType = keyof NotificationData;
