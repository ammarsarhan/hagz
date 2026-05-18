import prisma from "@/shared/lib/utils/prisma.js";
import { NotificationChannel, UserStatus, type NotificationEvent } from "@/generated/prisma/enums.js";
import { notificationsQueue } from "@/jobs/queues/notifications.queue.js";
import { BadRequestError, ERROR_CODES } from "@/shared/lib/utils/error.js";
import type { NotificationPayloadMap, NotificationsJobPayload } from "@/shared/types/notifications.js";

interface BaseNotificationPayload {
    userId?: string;
    phone?: string;
};

export type CreateNotificationPayload = BaseNotificationPayload & {
    [E in NotificationEvent]: {
        event: E;
        data: NotificationPayloadMap[E];
    }
}[NotificationEvent];

export default class NotificationsService {
    resolveChannels = async (userId?: string, phone?: string) => {
        if (userId && !phone) {
            const preferences = await prisma.userPreferences.findUnique({ 
                where: { 
                    userId,
                    user: { 
                        status: UserStatus.ACTIVE
                    }
                },
                select: { notifications: true }
            });
    
            if (!preferences) throw new BadRequestError("Could not find active user with the specfied ID.", ERROR_CODES.USER_NOT_ACTIVE);
    
            const channels = preferences.notifications;
            return channels;
        } else if (!userId && phone) {
            return [NotificationChannel.WHATSAPP];
        } else {
            throw new BadRequestError("Could not resolve notification channels.", ERROR_CODES.VALIDATION_FAILED);
        }
    };

    createNotification = async ({ userId, phone, event, data } : CreateNotificationPayload) => {
        // Get the channels based on the provided payload.
        const channels = await this.resolveChannels(userId, phone);

        const { deliveries } = await prisma.$transaction(async tx => {
            // Create the notification record and figure out the channels we want to send it through.
            const notification = await tx.notification.create({
                data: {
                    userId,
                    phone,
                    event,
                    payload: data
                }
            });
    
            // Loop through each of the channels and asynchronously create a delivery.
            const deliveries = await Promise.all(
                channels.map((channel) =>
                    tx.notificationDelivery.create({
                        data: {
                            notificationId: notification.id,
                            channel,
                        },
                    })
                )
            );
            
            return { notification, channels, deliveries };
        });

        // Map through each of the channels and add the delivery to the queue in parallel.
        await Promise.all(
            deliveries.map((delivery) => {
                const payload = { deliveryId: delivery.id, notificationId: delivery.notificationId, channel: delivery.channel, phone, userId, event, payload: data } as NotificationsJobPayload;
                return notificationsQueue.add("send", payload);
            })
        );
    };
}