import jwtService from "@/domains/tokens/jwt.service.js";
import { createUserResponse } from "@/domains/auth/auth.validator.js";
import type { FetchUserPayloadType, SignInPayloadType, SignUpPayloadType, UserResponseType } from "@/domains/auth/auth.validator.js";

import prisma from "@/shared/lib/prisma.js";
import { hashPassword, verifyPassword } from "@/shared/lib/hash.js";
import { ConflictError, InternalServerError, NotFoundError, ERROR_CODES, UnauthorizedError, ForbiddenError } from "@/shared/lib/error.js";
import { addDays } from "date-fns";

export default class AuthService {
    private readonly MAXIMUM_SESSION_LIMIT = 5;

    createUser = async (payload: SignUpPayloadType): Promise<UserResponseType> => {
        const exists = await prisma.user.findUnique({ where: { phone: payload.phone }});
        if (exists) throw new ConflictError("A user with the specified phone number already exists.", ERROR_CODES.USER_PHONE_ALREADY_EXISTS)

        const hashed = await hashPassword(payload.password);
        
        const { user, preferences } = await prisma.$transaction(async (tx) => {
            // Create the actual user account and return the data we need for the AuthContext on the frontend.
            const user = await tx.user.create({
                data: {
                    ...payload,
                    password: hashed
                },
                include: {
                    pitches: true
                }
            });

            // Create userPreferences to store data about the display/action preferences.
            const preferences = await tx.userPreferences.create({
                data: { userId: user.id }
            });

            return { user, preferences };
        });

        const pitches = user.pitches;

        // Parse into an object that can be used with the client's AuthContext or Mobile implementations.
        return createUserResponse(user, preferences, pitches);
    };

    fetchUser = async (params: FetchUserPayloadType): Promise<UserResponseType> => {
        if (params.type === "phone") {
            const user = await prisma.user.findUnique({ 
                where: { phone: params.phone },
                include: {
                    pitches: true,
                    preferences: true
                }
            });
            
            if (!user) throw new NotFoundError("Could not find user with the specified phone.", ERROR_CODES.USER_PHONE_DOES_NOT_EXIST);

            // We can assume that preferences always exists because it is created as a transaction with the creation of the user.
            // A user may not exist without their preferences unlike type-inference from the schema suggests.
            const preferences = user.preferences!;
            const pitches = user.pitches;

            return createUserResponse(user, preferences, pitches);
        };

        if (params.type === "id") {
            const user = await prisma.user.findUnique({ 
                where: { id: params.id },
                include: {
                    pitches: true,
                    preferences: true
                }
            });
            
            if (!user) throw new NotFoundError("Could not find user with the specified id.", ERROR_CODES.USER_ID_DOES_NOT_EXIST);

            // We can assume that preferences always exists because it is created as a transaction with the creation of the user.
            // A user may not exist without their preferences unlike type-inference from the schema suggests.
            const preferences = user.preferences!;
            const pitches = user.pitches;

            return createUserResponse(user, preferences, pitches);
        };

        throw new InternalServerError("Either a phone or an id string must be specified to fetch a user.");
    };

    signIn = async (payload: SignInPayloadType, ipAddress: string | null, userAgent: string | null) => {
        // Find the user account, make sure the password is correct, and make sure the status is ok to sign in.
        const user = await prisma.user.findUnique({ 
            where: { phone: payload.phone }, 
            include: { 
                preferences: true, 
                pitches: true 
            } 
        });

        if (!user) throw new UnauthorizedError("Could not find user account with the specified credentials.", ERROR_CODES.USER_PHONE_DOES_NOT_EXIST);

        const isValid = await verifyPassword(user.password, payload.password);
        if (!isValid) throw new UnauthorizedError("Could not find user account with the specified credentials.", ERROR_CODES.USER_PHONE_DOES_NOT_EXIST);

        if (["SUSPENDED", "BANNED", "DELETED"].includes(user.status)) throw new ForbiddenError("User account is not active. You are not allowed to sign in.", ERROR_CODES.USER_ACCOUNT_NOT_ACTIVE);
        
        // If the user passes the validation, generate the refresh and access tokens.
        const { refreshToken, accessToken } = await jwtService.generateTokenPair(user.id, user.phone);

        // Invalidate other sessions if they are above the maximum limit and store this session with the information extracted from the request.
        const activeSessions = await prisma.session.findMany({
            where: {
                userId: user.id,
                revokedAt: null,
                expiresAt: { gt: new Date() }
            },
            orderBy: { createdAt: "asc" }, // Sort by the oldest to the newest
            select: { id: true }
        });
        
        // Wrap in a transaction to make sure this happens atomically.
        await prisma.$transaction(async (tx) => {
            // Revoke the oldest session to make way for the new session being created.
            if (activeSessions.length >= this.MAXIMUM_SESSION_LIMIT) {
                await tx.session.update({
                    where: { id: activeSessions[0].id },
                    data: { revokedAt: new Date() }
                });
            };
    
            await tx.session.create({
                data: {
                    userId: user.id,
                    refreshToken,
                    expiresAt: addDays(new Date(), 7),
                    ipAddress,
                    userAgent
                }
            });
        });

        const preferences = user.preferences!;
        const pitches = user.pitches;

        return { 
            user: createUserResponse(user, preferences, pitches),
            accessToken,
            refreshToken
        };
    };
    
    signOut = async (token: string) => {
        await prisma.session.updateMany({
            where: {
                refreshToken: token,
                revokedAt: null,
            },
            data: { revokedAt: new Date() }
        });
    };

    refreshSession = async (refreshToken: string) => {
        // Check if the refreshToken is valid.
        const payload = await jwtService.verifyRefreshToken(refreshToken);

        // If it is valid we can send a request to the database to fetch it and verify its status (if it has been revoked and if the user id matches up).
        // We don't need to check expiresAt because this is already done by the JWTService and is redundant (simply there as an audit field in database).
        const storedToken = await prisma.session.findUnique({
            where: { refreshToken },
            include: { user: { select: { phone: true } } }
        });

        if (!storedToken || storedToken.userId !== payload.id || storedToken.revokedAt) {
            throw new UnauthorizedError(
                "Session has expired or been revoked. Please sign in again.",
                ERROR_CODES.USER_SESSION_EXPIRED
            );
        }

        // If the refreshToken is valid, generate a new access token.
        const accessToken = await jwtService.signAccessToken({
            id: payload.id,
            phone: storedToken.user.phone
        });

        return { accessToken };
    };
}