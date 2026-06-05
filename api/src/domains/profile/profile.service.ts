import { UserStatus } from "@/generated/prisma/enums.js"
import { BadRequestError, ERROR_CODES, ForbiddenError, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";
import prisma from "@/shared/lib/utils/prisma.js"
import { createUserResponse } from "@/domains/auth/auth.validator.js";
import type { CreateAvatarPresignLinkPayloadType, UpdateUserPreferencesPayloadType, UpdateUserProfilePayloadType } from "@/domains/profile/profile.validator.js";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET, s3 } from "@/shared/lib/utils/s3.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

    generateAvatarPresignLink = async (userId: string, payload: CreateAvatarPresignLinkPayloadType) => {
        const user = await prisma.user.findFirst({
            where: { id: userId, status: UserStatus.ACTIVE }
        });

        if (!user)
            throw new NotFoundError("Could not find user profile with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        const extension = payload.contentType.split("/")[1];
        const key = `profiles/${userId}/${randomUUID()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: payload.contentType,
            ContentLength: payload.size,
        });

        // Temporary presigned URL returned to the client for uploading.
        const presign = await getSignedUrl(s3.presign, command, { expiresIn: 300 });

        return { presign, id: key };
    };

    confirmAvatarUpload = async (userId: string, key: string) => {
        const user = await prisma.user.findFirst({
            where: { id: userId, status: UserStatus.ACTIVE }
        });

        if (!user)
            throw new NotFoundError("Could not find user profile with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        // Security check: Ensure the key actually belongs to this user.
        if (!key.startsWith(`profiles/${userId}/`))
            throw new ForbiddenError("You do not have permission to confirm this upload.", ERROR_CODES.PROFILE_ACCESS_FORBIDDEN);

        // Verify the object actually exists in S3 before confirming.
        try {
            await s3.default.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        } catch {
            throw new BadRequestError("Upload could not be verified. Please try uploading again.", ERROR_CODES.USER_AVATAR_CONFIRMATION_FAILED);
        };

        // If there was a previous avatar, we should delete it from S3.
        if (user.avatarKey && user.avatarKey !== key) {
            try {
                await s3.default.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: user.avatarKey }));
            } catch (e) {
                console.error(`Failed to delete old avatar for user ${userId}: ${e}`);
            }
        }

        // Construct the permanent public read URL.
        const url = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                avatarUrl: url,
                avatarKey: key
            },
            include: { preferences: true, pitches: true }
        });

        if (!updated.preferences)
            throw new InternalServerError("Could not find preferences associated with the specified user ID.", ERROR_CODES.USER_PREFERENCES_NOT_FOUND);

        return createUserResponse(updated, updated.preferences, updated.pitches);
    };

    deleteAvatar = async (userId: string) => {
        const user = await prisma.user.findFirst({
            where: { id: userId, status: UserStatus.ACTIVE }
        });

        if (!user)
            throw new NotFoundError("Could not find user profile with the specified ID.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

        if (!user.avatarKey)
            throw new BadRequestError("User does not have an avatar to delete.", ERROR_CODES.USER_AVATAR_NOT_FOUND);

        try {
            await s3.default.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: user.avatarKey }));
        } catch (e) {
            console.error(`Failed to delete avatar for user ${userId}: ${e}`);
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                avatarUrl: null,
                avatarKey: null
            },
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

        if (!user.preferences)
            throw new InternalServerError("Could not find preferences associated with the specified user ID.", ERROR_CODES.USER_PREFERENCES_NOT_FOUND);

        const { sports, sizes, ...rest } = payload;

        const updated = await prisma.userPreferences.update({
            where: {
                userId,
            },
            data: {
                ...rest,
                ...(sports && { sport: sports }),
                ...(sizes && { size: sizes }),
            },
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