import { Factory } from "hono/factory"
import { authorize } from "@/domains/auth/auth.middleware.js";
import NotificationsService from "../notifications/notifications.service.js";
import { BadRequestError, ERROR_CODES } from "@/shared/lib/utils/error.js";

const factory = new Factory();
const notificationsService = new NotificationsService();

export const fetchProfileNotificationsHandler = factory.createHandlers(
    authorize,
    async (c) => {
        const notifications = await notificationsService.fetchUserInAppNotifications(c.var.id);
        return c.json({ success: true, data: { notifications } }, 200);
    }
);

export const readNotificationHandler = factory.createHandlers(
    authorize,
    async (c) => {
        const notificationId = c.req.param("notificationId");

        if (!notificationId)
            throw new BadRequestError("Could not mark notification as read. Notification ID was not provided.", ERROR_CODES.NOTIFICATION_NOT_FOUND);

        const notification = await notificationsService.readUserInAppNotification(c.var.id, notificationId);
        return c.json({ success: true, data: { notification } }, 200); 
    }
)
