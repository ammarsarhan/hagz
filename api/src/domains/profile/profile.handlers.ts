import { Factory } from "hono/factory"
import { authorize } from "@/domains/auth/auth.middleware.js";
import validate from "@/shared/middleware/validate.middleware.js";
import NotificationsService from "@/domains/notifications/notifications.service.js";
import ProfileService from "@/domains/profile/profile.service.js";
import { BadRequestError, ERROR_CODES, UnauthorizedError } from "@/shared/lib/utils/error.js";
import { updateUserProfileSchema, updateUserPreferencesSchema, createAvatarPresignLinkSchema, transferAccountSchema } from "@/domains/profile/profile.validator.js";
import { getCookie } from "hono/cookie";

const factory = new Factory();
const profileService = new ProfileService();
const notificationsService = new NotificationsService();

export const getProfileHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const profile = await profileService.getUserProfile(userId);
        return c.json({ success: true, data: { profile } }, 200);
    }
);

export const updateProfileHandler = factory.createHandlers(
    authorize({ required: true }),
    validate("json", updateUserProfileSchema),
    async (c) => {
        const userId = c.var.id;
        const payload = c.req.valid("json");

        const profile = await profileService.updateUserProfile(userId, payload);
        return c.json({ success: true, data: { profile } }, 200); 
    }
);

export const createAvatarPresignLinkHandler = factory.createHandlers(
    authorize({ required: true }),
    validate("json", createAvatarPresignLinkSchema),
    async (c) => {
        const userId = c.var.id;
        const payload = c.req.valid("json");

        const { presign, id } = await profileService.generateAvatarPresignLink(userId, payload);

        return c.json({ success: true, data: { presign, id } }, 200); 
    }
);

export const confirmAvatarUploadHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const avatarId = c.req.param("avatarId");

        if (!avatarId)
            throw new BadRequestError("User profile avatar was not provided.", ERROR_CODES.USER_AVATAR_NOT_FOUND);

        const profile = await profileService.confirmAvatarUpload(userId, avatarId);
        return c.json({ success: true, data: { profile } }, 200);
    }
);

export const deleteAvatarHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const profile = await profileService.deleteAvatar(userId);
        return c.json({ success: true, data: { profile } }, 200);
    }
);

export const fetchProfileNotificationsHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const notifications = await notificationsService.fetchUserInAppNotifications(c.var.id);
        return c.json({ success: true, data: { notifications } }, 200);
    }
);

export const getPreferencesHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const preferences = await profileService.getUserPreferences(userId);
        return c.json({ success: true, data: { preferences } }, 200);
    }
);

export const updatePreferencesHandler = factory.createHandlers(
    authorize({ required: true }),
    validate("json", updateUserPreferencesSchema),
    async (c) => {
        const userId = c.var.id;
        const payload = c.req.valid("json");

        const profile = await profileService.updateUserPreferences(userId, payload);

        return c.json({ success: true, data: { profile } }, 200);
    }
)

export const transferAccountHandler = factory.createHandlers(
    authorize({ required: true }),
    validate("json", transferAccountSchema),
    async (c) => {
        const userId = c.var.id;
        const { role } = c.req.valid("json");
        const profile = await profileService.transferAccount(userId, role);

        return c.json({ success: true, data: { profile } }, 200);
    }
)

export const readNotificationHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const notificationId = c.req.param("notificationId");

        if (!notificationId)
            throw new BadRequestError("Could not mark notification as read. Notification ID was not provided.", ERROR_CODES.NOTIFICATION_NOT_FOUND);

        const notification = await notificationsService.readUserInAppNotification(c.var.id, notificationId);
        return c.json({ success: true, data: { notification } }, 200); 
    }
);

export const fetchSessionsHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
    
        const currentToken = 
            getCookie(c, "refreshToken") ||   // Web
            c.req.header("X-Refresh-Token");  // Mobile

        if (!currentToken)
            throw new UnauthorizedError("Could not fetch the current refresh token associated with this session. Please sign in again.", ERROR_CODES.UNAUTHORIZED);

        const sessions = await profileService.fetchUserActiveSessions(userId, currentToken);
        return c.json({ success: true, data: { sessions } }, 200); 
    }
);

export const deleteSessionHandler = factory.createHandlers(
    authorize({ required: true }),
    async (c) => {
        const userId = c.var.id;
        const sessionId = c.req.param("sessionId");

        const currentToken = 
            getCookie(c, "refreshToken") ||   // Web
            c.req.header("X-Refresh-Token");  // Mobile

        if (!currentToken)
            throw new UnauthorizedError("Could not fetch the current refresh token associated with this session. Please sign in again.", ERROR_CODES.UNAUTHORIZED);

        if (!sessionId)
            throw new BadRequestError("Could not delete session. No session ID provided in the parameters.", ERROR_CODES.USER_SESSION_NOT_FOUND);

        await profileService.deleteUserSession(userId, sessionId, currentToken);
        return c.json({ success: true, data: null }, 200); 
    }
);
