import { NotificationChannel, NotificationEvent } from "@/generated/prisma/enums.js";
import type { NotificationPayloadMap } from "@/shared/types/notifications.js";

type InAppTemplate = {
    title: string;
    body: string;
};

type WhatsappTemplate = {
    templateName: string;
    variables: string[];
};

type ChannelTemplate = {
    [NotificationChannel.IN_APP]: InAppTemplate;
    [NotificationChannel.WHATSAPP]: WhatsappTemplate;
    // Todo: Implement these channels later.
    [NotificationChannel.PUSH]: never;
    [NotificationChannel.EMAIL]: never;
};

type TemplateMap = {
    [E in NotificationEvent]?: {
        [C in NotificationChannel]?: (ctx: NotificationPayloadMap[E]) => ChannelTemplate[C];
    };
};

// WhatsApp template variable reference:
// customer:   {{1}} receiverName, {{2}} groundName, {{3}} pitchName, {{4}} startTime, {{5}} action, {{6}} deepLink
// staff:      {{1}} action, {{2}} groundName, {{3}} pitchName, {{4}} startTime, {{5}} customerName, {{6}} deepLink
// reminder:   {{1}} receiverName, {{2}} bookingArticle ("your"/"a"), {{3}} groundName, {{4}} pitchName, {{5}} startTime
// payout:     {{1}} receiverName, {{2}} payoutReference, {{3}} processedAt, {{4}} action, {{5}} deepLink
// invitation: {{1}} receiverName, {{2}} actorName, {{3}} action, {{4}} pitchName
// onboard:    {{1}} receiverName, {{2}} actorName, {{3}} pitchName, {{4}} deepLink, {{5}} expiresAt

export const templates: TemplateMap = {
    [NotificationEvent.BOOKING_RECEIVED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "staff",
            variables: [ctx.action, ctx.groundName, ctx.pitchName, ctx.startTime, ctx.customerName, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Received`,
            body: `A booking has been ${ctx.action} at ${ctx.groundName} (${ctx.pitchName}) for ${ctx.startTime} by ${ctx.customerName}.`,
        }),
    },
    [NotificationEvent.BOOKING_RESERVED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "customer",
            variables: [ctx.receiverName, ctx.groundName, ctx.pitchName, ctx.startTime, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Reserved`,
            body: `Your booking at ${ctx.groundName} (${ctx.pitchName}) for ${ctx.startTime} has been ${ctx.action}`,
        }),
    },
    [NotificationEvent.BOOKING_CONFIRMED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "customer",
            variables: [ctx.receiverName, ctx.groundName, ctx.pitchName, ctx.startTime, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Confirmed`,
            body: `Your booking at ${ctx.groundName} (${ctx.pitchName}) for ${ctx.startTime} has been ${ctx.action}`,
        }),
    },
    [NotificationEvent.BOOKING_CANCELLED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "customer",
            variables: [ctx.receiverName, ctx.groundName, ctx.pitchName, ctx.startTime, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Cancelled`,
            body: `Your booking at ${ctx.groundName} (${ctx.pitchName}) for ${ctx.startTime} has been ${ctx.action}`,
        }),
    },
    [NotificationEvent.BOOKING_RESCHEDULED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "customer",
            variables: [ctx.receiverName, ctx.groundName, ctx.pitchName, ctx.startTime, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Rescheduled`,
            body: `Your booking at ${ctx.groundName} (${ctx.pitchName}) for ${ctx.startTime} has been ${ctx.action}`,
        }),
    },
    [NotificationEvent.BOOKING_REMINDER]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "reminder",
            variables: [ctx.receiverName, ctx.bookingArticle, ctx.groundName, ctx.pitchName, ctx.startTime],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Upcoming Booking`,
            body: `Reminder: you have a scheduled booking at ${ctx.pitchName} (${ctx.groundName}) on ${ctx.startTime}.`,
        }),
    },
    [NotificationEvent.BOOKING_STARTED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "customer",
            variables: [ctx.receiverName, ctx.groundName, ctx.pitchName, ctx.startTime, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Started`,
            body: `Your booking at ${ctx.groundName} (${ctx.pitchName}) has ${ctx.action}`,
        }),
    },
    [NotificationEvent.BOOKING_EXPIRED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "customer",
            variables: [ctx.receiverName, ctx.groundName, ctx.pitchName, ctx.startTime, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking Expired`,
            body: `Your booking at ${ctx.groundName} (${ctx.pitchName}) for ${ctx.startTime} has ${ctx.action}`,
        }),
    },
    [NotificationEvent.BOOKING_NO_SHOW]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "customer",
            variables: [ctx.receiverName, ctx.groundName, ctx.pitchName, ctx.startTime, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Booking No-Show`,
            body: `Your booking at ${ctx.groundName} (${ctx.pitchName}) for ${ctx.startTime} has been ${ctx.action}`,
        }),
    },
    [NotificationEvent.PAYOUT_PROCESSED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "payout",
            variables: [ctx.receiverName, ctx.payoutReference, ctx.processedAt, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Payout Processed`,
            body: `Your payout of ${ctx.amount} EGP has been processed.`,
        }),
    },
    [NotificationEvent.PAYOUT_FAILED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "payout",
            variables: [ctx.receiverName, ctx.payoutReference, ctx.processedAt, ctx.action, ctx.deepLink],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Payout Failed`,
            body: `Your payout of ${ctx.amount} EGP failed. Reason: ${ctx.reason}.`,
        }),
    },
    [NotificationEvent.INVITATION_CREATED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "invitation",
            variables: [ctx.receiverName, ctx.actorName, ctx.action, ctx.pitchName],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Invitation Sent`,
            body: `An invitation to manage ${ctx.pitchName} was sent to ${ctx.phone}. It expires on ${ctx.expiresAt}.`,
        }),
    },
    [NotificationEvent.INVITATION_RECEIVED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "onboard",
            variables: [ctx.receiverName, ctx.actorName, ctx.pitchName, ctx.deepLink, ctx.expiresAt],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Pitch Invitation`,
            body: `You've been invited to help manage ${ctx.pitchName}. This invitation expires on ${ctx.expiresAt}.`,
        }),
    },
    [NotificationEvent.INVITATION_ACCEPTED]: {
        [NotificationChannel.WHATSAPP]: (ctx) => ({
            templateName: "invitation",
            variables: [ctx.receiverName, ctx.actorName, ctx.action, ctx.pitchName],
        }),
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Invitation Accepted`,
            body: `${ctx.phone} has accepted their invitation to manage ${ctx.pitchName}.`,
        }),
    },
    [NotificationEvent.PITCH_UPDATED]: {
        [NotificationChannel.IN_APP]: (ctx) => ({
            title: `Pitch Updated`,
            body: `${ctx.pitchName} has been updated.`,
        }),
    },
};

export function resolveTemplate<E extends NotificationEvent, C extends NotificationChannel>(
    event: E,
    channel: C,
    ctx: NotificationPayloadMap[E],
): ChannelTemplate[C] {
    const template = templates[event]?.[channel] as ((ctx: NotificationPayloadMap[E]) => ChannelTemplate[C]) | undefined;
    if (!template) throw new Error(`No template defined for event=${event} channel=${channel}`);
    return template(ctx);
}