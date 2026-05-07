import { NotificationChannel, NotificationEvent } from "@/generated/prisma/enums.js";
import type { NotificationPayloadMap } from "@/shared/types/notifications.js";

type Template = {
    title?: string;
    body: string;
};

type TemplateMap = {
    [E in NotificationEvent]?: Partial<Record<NotificationChannel, (ctx: NotificationPayloadMap[E]) => Template>>;
};

export const templates: TemplateMap = {
    [NotificationEvent.BOOKING_CONFIRMED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `Your booking at ${ctx.pitchName} is confirmed. It starts at ${ctx.startTime} and ends at ${ctx.endTime}. View details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Confirmed`,
            body: `Your booking at ${ctx.pitchName} is confirmed for ${ctx.startTime}.`,
        }),
    },
    [NotificationEvent.BOOKING_CANCELLED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `Your booking at ${ctx.pitchName} scheduled for ${ctx.startTime} has been cancelled. View details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Cancelled`,
            body: `Your booking at ${ctx.pitchName} scheduled for ${ctx.startTime} has been cancelled.`,
        }),
    },
    [NotificationEvent.BOOKING_RESCHEDULED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `Your booking at ${ctx.pitchName} has been rescheduled from ${ctx.previousTime} to ${ctx.newTime}. View details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Rescheduled`,
            body: `Your booking at ${ctx.pitchName} has moved from ${ctx.previousTime} to ${ctx.newTime}.`,
        }),
    },
    [NotificationEvent.BOOKING_REMINDER]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `Reminder: You have a booking at ${ctx.pitchName} coming up at ${ctx.startTime}. View details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Upcoming Booking`,
            body: `You have a booking at ${ctx.pitchName} at ${ctx.startTime}.`,
        }),
    },
    [NotificationEvent.BOOKING_STARTED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `Your booking at ${ctx.pitchName} has started. It ends at ${ctx.endTime}. Enjoy your game!`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Started`,
            body: `Your booking at ${ctx.pitchName} is now in progress. Ends at ${ctx.endTime}.`,
        }),
    },
    [NotificationEvent.BOOKING_EXPIRED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `Your booking at ${ctx.pitchName} scheduled for ${ctx.startTime} has expired due to no payment. View details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Expired`,
            body: `Your booking at ${ctx.pitchName} for ${ctx.startTime} has expired.`,
        }),
    },
    [NotificationEvent.BOOKING_NO_SHOW]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `You missed your booking at ${ctx.pitchName} scheduled for ${ctx.startTime}. View details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking No-Show`,
            body: `You were marked as a no-show for your booking at ${ctx.pitchName} on ${ctx.startTime}.`,
        }),
    },
    [NotificationEvent.PAYOUT_PROCESSED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `Your payout of ${ctx.amount} EGP has been processed successfully. View details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Payout Processed`,
            body: `Your payout of ${ctx.amount} EGP has been processed.`,
        }),
    },
    [NotificationEvent.PAYOUT_FAILED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `Your payout of ${ctx.amount} EGP failed. Reason: ${ctx.reason}. View details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Payout Failed`,
            body: `Your payout of ${ctx.amount} EGP failed. Reason: ${ctx.reason}.`,
        }),
    },
    [NotificationEvent.INVITATION_CREATED]: {
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Invitation Sent`,
            body: `An invitation to manage ${ctx.pitchName} was sent to ${ctx.phone}. It expires on ${ctx.expiresAt}.`,
        }),
    },
    [NotificationEvent.INVITATION_RECEIVED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `You've been invited to help manage ${ctx.pitchName}. Accept here: ${ctx.deepLink}. This invitation expires on ${ctx.expiresAt}.`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Pitch Invitation`,
            body: `You've been invited to help manage ${ctx.pitchName}. This invitation expires on ${ctx.expiresAt}.`,
        }),
    },
    [NotificationEvent.INVITATION_ACCEPTED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `${ctx.phone} has accepted their invitation to manage ${ctx.pitchName}. View pitch: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Invitation Accepted`,
            body: `${ctx.phone} has accepted their invitation to manage ${ctx.pitchName}.`,
        }),
    },
    [NotificationEvent.PITCH_UPDATED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            body: `${ctx.pitchName} has been updated. View the latest details: ${ctx.deepLink}`,
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Pitch Updated`,
            body: `${ctx.pitchName} has been updated.`,
        }),
    },
};

export function resolveTemplate<E extends NotificationEvent>(event: E, channel: NotificationChannel, ctx: NotificationPayloadMap[E]): Template {
    const template = templates[event]?.[channel];
    if (!template) throw new Error(`No template defined for event=${event} channel=${channel}`);
    return template(ctx);
};
