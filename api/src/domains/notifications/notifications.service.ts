import prisma from "@/shared/lib/utils/prisma.js";
import { NotificationChannel, NotificationStatus, UserStatus, type NotificationEvent } from "@/generated/prisma/enums.js";
import { notificationsQueue } from "@/jobs/queues/notifications.queue.js";
import { BadRequestError, ERROR_CODES, UnauthorizedError } from "@/shared/lib/utils/error.js";
import type { NotificationPayloadMap, NotificationsJobPayload } from "@/shared/types/notifications.js";
import { resolveTemplate } from "@/shared/lib/providers/templates.js";

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
    private static readonly resolveChannels = async (userId?: string, phone?: string) => {
        if (userId && !phone) {
            const user = await prisma.user.findUnique({ 
                where: {
                    id: userId,
                    status: UserStatus.ACTIVE
                },
                include: { preferences: true }
            })
    
            if (!user || !user.preferences) throw new BadRequestError("Could not find active user with the specfied ID.", ERROR_CODES.USER_NOT_ACTIVE);
    
            const channels = user.preferences.notifications;
            const phone = user.phone;
            const email = user.email;

            const providers = { phone, email };

            return { channels, providers };
        } else if (!userId && phone) {
            const channels = [NotificationChannel.WHATSAPP] as NotificationChannel[];
            const providers = { phone };

            return { channels, providers };
        } else {
            throw new BadRequestError("Could not resolve notification channels.", ERROR_CODES.VALIDATION_FAILED);
        }
    };

    static createNotification = async ({ userId, phone, event, data } : CreateNotificationPayload) => {
        // Get the channels based on the provided payload.
        const { channels, providers } = await this.resolveChannels(userId, phone);

        const { deliveries } = await prisma.$transaction(async tx => {
            // Create the notification record and figure out the channels we want to send it through.
            const notification = await tx.notification.create({
                data: {
                    userId,
                    phone,
                    event,
                    payload: data,
                    // Resolve and store the in-app template if the channel is included
                    ...(channels.includes(NotificationChannel.IN_APP) && (() => {
                        const { title, body } = resolveTemplate(event, NotificationChannel.IN_APP, data);
                        return { title, body };
                    })()),
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
                const payload = { deliveryId: delivery.id, notificationId: delivery.notificationId, channel: delivery.channel, phone: providers.phone, userId, event, payload: data } as NotificationsJobPayload;
                return notificationsQueue.add("dispatch", payload);
            })
        );
    };

    fetchUserInAppNotifications = async (userId: string, unreadOnly: boolean = false) => {
        const user = await prisma.user.findUnique({ where: { id: userId, status: { not: UserStatus.DELETED } }});

        if (!user)
            throw new UnauthorizedError("Could not fetch user notifications. Can not find user account.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        const notifications = await prisma.notification.findMany({
            where: {
                userId,
                ...(unreadOnly && { readAt: null }),
                deliveries: {
                    some: {
                        channel: NotificationChannel.IN_APP,
                        status: NotificationStatus.SENT
                    }
                }
            }
        });

        return notifications;
    };

    readUserInAppNotification = async (userId: string, notificationId: string) => {
        const user = await prisma.user.findUnique({ where: { id: userId, status: { not: UserStatus.DELETED } }});

        if (!user)
            throw new UnauthorizedError("Could not fetch user notifications. Can not find user account.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        const delivery = await prisma.notificationDelivery.findFirst({ 
            where: {
                channel: NotificationChannel.IN_APP,
                notificationId,
                status: NotificationStatus.SENT,
                notification: {
                    userId
                }
            }
        });

        if (!delivery)
            throw new BadRequestError("Could not read notification for the specified in app notification.", ERROR_CODES.NOTIFICATION_NOT_FOUND);

        const updated = await prisma.notification.update({
            where: {
                id: notificationId,
                deliveries: {
                    some: {
                        id: delivery.id
                    }
                }
            },
            data: {
                readAt: new Date()
            }
        });

        return updated;
    };
}