import * as argon2 from "argon2";

import TokenService from '@/domains/token/token.service';
import UserService from '@/domains/user/user.service';
import PitchService from "@/domains/pitch/pitch.service";
import { CreateUserPayload, SignInPayload, UserMeta } from '@/domains/user/user.validator';

import { ConflictError, NotFoundError, UnauthorizedError } from '@/shared/lib/error';

export default class AuthService {
    private userService = new UserService();
    private pitchService = new PitchService();

    registerUser = async (payload: CreateUserPayload, meta: UserMeta) => {
        const existingUser = await this.userService.fetchUserByPhone(payload.phone, true);
        if (existingUser) throw new ConflictError("A user with the specified phone number already exists.");
        
        const hash = await argon2.hash(payload.password);

        const user = await this.userService.createUser({
            ...payload,
            password: hash
        });

        const tokens = await TokenService.generateTokenPair({ 
            id: user.id,
            phone: user.phone,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            isOnboarded: false, 
            isVerified: false
        }, meta);

        return { tokens };
    };

    signInUser = async (payload: SignInPayload, meta: UserMeta) => {        
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

        const userData = { 
            id: user.id, 
            phone: user.phone,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            isVerified: user.isVerified,
            isOnboarded,
        };

        const tokens = await TokenService.generateTokenPair(userData, meta);
    
        return { tokens, user: userData, permissions };
    };

    getSessionData = async (token: string) => {
        const { id } = TokenService.verifyAccessToken(token);
        const user = await this.userService.fetchUserById(id, true);

        return user;
    }

    refreshSessionToken = async (token: string) => {
        const { id } = await TokenService.verifyRefreshToken(token);

        const revoked = await TokenService.revokeRefreshToken(token);
        if (!revoked) throw new UnauthorizedError("Refresh token has already been used.");

        const [user, permissions] = await Promise.all([
            this.userService.fetchUserById(id),
            this.pitchService.getAdminPermissions(id)
        ])
        
        if (!user) throw new NotFoundError("Could not find user with the specified credentials.");
        if (!permissions) throw new NotFoundError("Could not find user permissions with the specified credentials.");

        const isOnboarded = permissions.length > 0;

        const tokens = await TokenService.generateTokenPair({ 
            id: user.id, 
            phone: user.phone,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            isVerified: user.isVerified,
            isOnboarded,
        });

        return tokens;
    };

    signOutUser = async (token: string) => await TokenService.revokeRefreshToken(token);
}