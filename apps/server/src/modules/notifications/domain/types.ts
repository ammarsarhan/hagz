// Every notification type, with the template data it carries. Text is rendered from these in the
// recipient's language when it's sent; deep links are derived from the type and its context.
export interface NotificationData {
  // A member of the venue reset their password and was made read-only there. `eventId` is the
  // VenueEvent holding their previous permissions, for "restore".
  STAFF_PASSWORD_RESET: { staffId: string; eventId: string };
}

export type NotificationType = keyof NotificationData;
