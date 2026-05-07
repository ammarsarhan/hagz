import type { NotificationChannel, NotificationEvent } from "@/generated/prisma/enums.js";

// Map out each of the notification events to their specified payload.
export type NotificationPayloadMap = {
    [NotificationEvent.BOOKING_CONFIRMED]: {
        pitchName: string;
        startTime: string;
        endTime: string;
        deepLink: string;
    };
    [NotificationEvent.BOOKING_CANCELLED]: {
        pitchName: string;
        startTime: string;
        deepLink: string;
    };
    [NotificationEvent.BOOKING_RESCHEDULED]: {
        pitchName: string;
        previousTime: string;
        newTime: string;
        deepLink: string;
    };
    [NotificationEvent.BOOKING_REMINDER]: {
        pitchName: string;
        startTime: string;
        deepLink: string;
    };
    [NotificationEvent.BOOKING_STARTED]: {
        pitchName: string;
        endTime: string;
        deepLink: string;
    };
    [NotificationEvent.BOOKING_EXPIRED]: {
        pitchName: string;
        startTime: string;
        deepLink: string;
    };
    [NotificationEvent.BOOKING_NO_SHOW]: {
        pitchName: string;
        startTime: string;
        deepLink: string;
    };
    [NotificationEvent.PAYOUT_PROCESSED]: {
        amount: number;
        deepLink: string;
    };
    [NotificationEvent.PAYOUT_FAILED]: {
        amount: number;
        reason: string;
        deepLink: string;
    };
    [NotificationEvent.INVITATION_CREATED]: {
        pitchName: string;
        phone: string;
        expiresAt: string;
    };
    [NotificationEvent.INVITATION_RECEIVED]: {
        pitchName: string;
        expiresAt: string;
        deepLink: string;
    };
    [NotificationEvent.INVITATION_ACCEPTED]: {
        pitchName: string;
        phone: string;
        deepLink: string;
    };
    [NotificationEvent.PITCH_UPDATED]: {
        pitchName: string;
        deepLink: string;
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
