import type { NotificationChannel, NotificationEvent } from "@/generated/prisma/enums.js";

// Map out each of the notification events to their specified payload.
export type NotificationPayloadMap = {
    // customer template: {{1}} receiverName, {{2}} groundName, {{3}} pitchName, {{4}} startTime, {{5}} action, {{6}} deepLink
    [NotificationEvent.BOOKING_RECEIVED]: {
        action: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        customerName: string;
        deepLink: string;
    };
    [NotificationEvent.BOOKING_RESERVED]: {
        receiverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "reserved. Payment is still required to confirm your spot";
        deepLink: string;
    };
    [NotificationEvent.BOOKING_CONFIRMED]: {
        receiverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "confirmed";
        deepLink: string;
    };
    [NotificationEvent.BOOKING_CANCELLED]: {
        receiverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "cancelled";
        deepLink: string;
    };
    // Todo: Consider a dedicated template to make the new time explicit.
    [NotificationEvent.BOOKING_RESCHEDULED]: {
        receiverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "rescheduled";
        deepLink: string;
    };
    [NotificationEvent.BOOKING_STARTED]: {
        receiverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "marked as in progress";
        deepLink: string;
    };
    [NotificationEvent.BOOKING_EXPIRED]: {
        receiverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "expired because it was not approved in time" | "expired because it was not paid for in time";
        deepLink: string;
    };
    [NotificationEvent.BOOKING_NO_SHOW]: {
        receiverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "marked as no-show";
        deepLink: string;
    };
    // reminder template: {{1}} receiverName, {{2}} bookingArticle, {{3}} groundName, {{4}} pitchName, {{5}} startTime
    [NotificationEvent.BOOKING_REMINDER]: {
        receiverName: string;
        bookingArticle: "your" | "a";
        groundName: string;
        pitchName: string;
        startTime: string;
    };
    // payout template: {{1}} receiverName, {{2}} payoutReference, {{3}} processedAt, {{4}} action, {{5}} deepLink
    [NotificationEvent.PAYOUT_PROCESSED]: {
        receiverName: string;
        payoutReference: string;
        processedAt: string;
        action: "approved";
        amount: number;         // used for IN_APP message only
        deepLink: string;
    };
    [NotificationEvent.PAYOUT_FAILED]: {
        receiverName: string;
        payoutReference: string;
        processedAt: string;
        action: "failed";
        amount: number;         // used for IN_APP message only
        reason: string;         // used for IN_APP message only
        deepLink: string;
    };
    // invitation template: {{1}} receiverName, {{2}} actorName, {{3}} action, {{4}} pitchName
    [NotificationEvent.INVITATION_CREATED]: {
        receiverName: string;
        actorName: string;
        action: "added as a staff manager by invitation";
        pitchName: string;
        phone: string;          // used for IN_APP message only
        expiresAt: string;      // used for IN_APP message only
    };
    [NotificationEvent.INVITATION_RECEIVED]: {
        receiverName: string;
        actorName: string;
        pitchName: string;
        deepLink: string;
        expiresAt: string;
    };
    [NotificationEvent.INVITATION_ACCEPTED]: {
        receiverName: string;
        actorName: string;
        action: "added as a staff manager by invitation";
        pitchName: string;
        phone: string;          // used for IN_APP message only
    };
    [NotificationEvent.PITCH_UPDATED]: {
        pitchName: string;
    };
};

// Base job shape without event/payload.
interface BaseJobPayload {
    deliveryId: string;
    notificationId: string;
    channel: NotificationChannel;
    userId?: string;
    phone?: string;
}

// Discriminated union, event and payload are tied together.
export type NotificationsJobPayload = BaseJobPayload & {
    [E in NotificationEvent]: {
        event: E;
        payload: NotificationPayloadMap[E];
    }
}[NotificationEvent];