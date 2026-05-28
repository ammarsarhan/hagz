import { UserStatus } from "@/generated/prisma/enums.js"
import { BadRequestError, ERROR_CODES, ForbiddenError, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";
import prisma from "@/shared/lib/utils/prisma.js"
import { createUserResponse } from "@/domains/auth/auth.validator.js";
import type { UpdateUserPreferencesPayloadType, UpdateUserProfilePayloadType } from "@/domains/profile/profile.validator.js";

export default class ProfileService {
    getUserProfile = async (userId: string) => {
        const user = await prisma.user.findFirst({ 
            where: { id: userId, status: { notIn: [UserStatus.DELETED, UserStatus.BANNED] } }, // Filter deleted and banned accounts.
            include: { preferences: true, pitches: true }
        });

        if (!user)
            throw new NotFoundError("Could not find user profile with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        if (!user.preferences)
            throw new InternalServerError("Could not find preferences associated with the specified user ID.", ERROR_CODES.USER_PREFERENCES_NOT_FOUND);

        return createUserResponse(user, user.preferences, user.pitches);
    }

    updateUserProfile = async (userId: string, payload: UpdateUserProfilePayloadType) => {
        const user = await prisma.user.findFirst({ 
            where: { id: userId, status: { notIn: [UserStatus.DELETED, UserStatus.BANNED] } }, // Filter deleted and banned accounts.
        });

        if (!user)
            throw new NotFoundError("Could not find user profile with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        // Make sure that the account is active to accept changes. Other than that reject. 
        if (user.status !== UserStatus.ACTIVE)
            throw new ForbiddenError("You may not edit your profile while the user account is not active. Please try again later.", ERROR_CODES.USER_NOT_ACTIVE);

        const updated = await prisma.user.update({
            where: { 
                id: userId,
                status: { not: UserStatus.DELETED }
            },
            data: payload,
            include: { preferences: true, pitches: true }
        });

        if (!updated.preferences)
            throw new InternalServerError("Could not find preferences associated with the specified user ID.", ERROR_CODES.USER_PREFERENCES_NOT_FOUND);

        return createUserResponse(updated, updated.preferences, updated.pitches);
    };

    getUserPreferences = async (userId: string) => {
        const user = await prisma.user.findFirst({ 
            where: { id: userId, status: { notIn: [UserStatus.DELETED, UserStatus.BANNED] } }, // Filter deleted and banned accounts.
            include: { preferences: true }
        });  
        
        if (!user)
            throw new NotFoundError("Could not find user profile with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        const preferences = user.preferences;

        if (!user.preferences)
            throw new InternalServerError("Could not find preferences associated with the specified user ID.", ERROR_CODES.USER_PREFERENCES_NOT_FOUND);

        return preferences;
    };

    updateUserPreferences = async (userId: string, payload: UpdateUserPreferencesPayloadType) => {
        const user = await prisma.user.findFirst({ 
            where: { id: userId, status: { notIn: [UserStatus.DELETED, UserStatus.BANNED] } }, // Filter deleted and banned accounts.
            include: { preferences: true }
        });  
        
        if (!user)
            throw new NotFoundError("Could not find user profile with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        const preferences = user.preferences;

        if (!user.preferences)
            throw new InternalServerError("Could not find preferences associated with the specified user ID.", ERROR_CODES.USER_PREFERENCES_NOT_FOUND);

        const updated = await prisma.userPreferences.update({
            where: {
                userId,
            },
            data: payload,
        });
        
        return updated;
    };

    fetchUserActiveSessions = async (userId: string, currentToken: string) => {
        const user = await prisma.user.findFirst({ 
            where: { id: userId, status: { notIn: [UserStatus.DELETED, UserStatus.BANNED] } }, // Filter deleted and banned accounts.
            include: { 
                sessions: {
                    where: {
                        revokedAt: null,
                        expiresAt: { gt: new Date() },
                        refreshToken: { not: currentToken }
                    },
                    omit: {
                        refreshToken: true
                    }
                }
            }
        }); 
        
        if (!user)
            throw new NotFoundError("Could not find user profile with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        const sessions = user.sessions;
        return sessions;
    };

    deleteUserSession = async (userId: string, sessionId: string, currentToken: string) => {
        const session = await prisma.session.findUnique({
            where: {
                userId,
                id: sessionId
            }
        });

        if (!session)
            throw new NotFoundError("Could not find session with the specified ID.", ERROR_CODES.USER_SESSION_NOT_FOUND);

        if (session.refreshToken == currentToken)
            throw new BadRequestError("Could not delete session associated with the refresh token used to sign in current active session. Please sign out instead.", ERROR_CODES.USER_SESSION_CONFLICT);

        if (session.revokedAt !== null || session.expiresAt <= new Date())
            throw new BadRequestError("Session has already expired or been revoked.", ERROR_CODES.USER_SESSION_EXPIRED);

        const updated = await prisma.session.delete({
            where: {
                id: sessionId
            }
        });

        return updated;
    }
}