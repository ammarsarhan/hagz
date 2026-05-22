import type { NotificationChannel, NotificationEvent } from "@/generated/prisma/enums.js";

// Map out each of the notification events to their specified payload.
export type NotificationPayloadMap = {
    [NotificationEvent.BOOKING_RESERVED]: {
        recieverName: string;   // {{1}} - "Ammar"
        groundName: string;     // {{2}} - "Porto Sport Football Pitches"
        pitchName: string;      // {{3}} - "Ground A"
        startTime: string;      // {{4}} - "18/1/2025 for 3:00 PM"
        action: "reserved. Payment is still required to confirm the spot";     // {{5}} - "reserved"
        deepLink: string;       // {{6}} - "https://www.hagz.com/booking/..."
    };
    [NotificationEvent.BOOKING_CONFIRMED]: {
        recieverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "confirmed successfully";
        deepLink: string;
    };
    [NotificationEvent.BOOKING_CANCELLED]: {
        recieverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "cancelled.";
        deepLink: string;
    };
    // Todo: Modify this with a custom template for it or make sure the new time is clear in the message.
    [NotificationEvent.BOOKING_RESCHEDULED]: {
        recieverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "rescheduled successfully.";
        deepLink: string;
    };
    [NotificationEvent.BOOKING_STARTED]: {
        recieverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "started.";
        deepLink: string;
    };
    // Todo: Modify this with a custom template for it.
    [NotificationEvent.BOOKING_EXPIRED]: {
        recieverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "expired.";
        deepLink: string;
    };
    [NotificationEvent.BOOKING_NO_SHOW]: {
        recieverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "marked as no-show.";
        deepLink: string;
    };
    // Todo: Modify this with a custom template for it.
    [NotificationEvent.BOOKING_REMINDER]: {
        recieverName: string;
        groundName: string;
        pitchName: string;
        startTime: string;
        action: "upcoming";
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
