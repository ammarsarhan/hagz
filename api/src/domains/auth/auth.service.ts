import * as argon2 from "argon2";

import JWTService from '@/domains/jwt/jwt.service';
import UserService from '@/domains/user/user.service';
import PitchService from "@/domains/pitch/pitch.service";
import { createUserPayload, signInPayload } from '@/domains/user/user.validator';

import { ConflictError, NotFoundError, UnauthorizedError } from '@/shared/lib/error';

export default class AuthService {
    private userService = new UserService();
    private pitchService = new PitchService();

    registerUser = async (payload: createUserPayload) => {
        const existingUser = await this.userService.fetchUserByPhone(payload.phone, true);
        if (existingUser) throw new ConflictError("A user with the specified phone number already exists.");
        
        const hash = await argon2.hash(payload.password);

        const user = await this.userService.createUser({
            ...payload,
            password: hash
        });

        const tokens = JWTService.generateTokenPair({ 
            id: user.id,
            phone: user.phone,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            isOnboarded: false, 
            isVerified: false 
        });

        return { tokens, user };
    };

    signInUser = async (payload: signInPayload) => {        
        const user = await this.userService.fetchUserByPhone(payload.phone);
        if (!user) throw new UnauthorizedError("Could not find an account with the specified credentials.");

        const verifyHash = await argon2.verify(user.password, payload.password);
        if (!verifyHash) throw new UnauthorizedError("Could not find an account with the specified credentials.");

        if (argon2.needsRehash(user.password)) {
            this.userService.updatePassword(user.id, user.password);
        };

        const { password, createdAt, updatedAt, ...data } = user;
        const permissions = await this.pitchService.getAdminPermissions(user.id);

        const isOnboarded = permissions.length > 0;
        const isVerified = user.status === "ACTIVE";

        const tokens = JWTService.generateTokenPair({ 
            id: user.id, 
            phone: user.phone,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            isOnboarded,
            isVerified
        });
    
        return { tokens, user: data, permissions };
    };

    getSessionData = async (token: string) => {
        const { id } = JWTService.verifyAccessToken(token);
        const user = await this.userService.fetchUserById(id, true);

        return user;
    }

    refreshSessionToken = async (token: string) => {
        const { id } = JWTService.verifyRefreshToken(token);

        const [user, permissions] = await Promise.all([
            this.userService.fetchUserById(id),
            this.pitchService.getAdminPermissions(id)
        ])
        
        if (!user) throw new NotFoundError("Could not find user with the specified credentials.");
        if (!permissions) throw new NotFoundError("Could not find user permissions with the specified credentials.");

        const isOnboarded = permissions.length > 0;
        const isVerified = user.status === "ACTIVE";

        const accessToken = JWTService.generateAccessToken({ 
            id: user.id, 
            phone: user.phone,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            isOnboarded,
            isVerified
        });

        return accessToken;
    }
}