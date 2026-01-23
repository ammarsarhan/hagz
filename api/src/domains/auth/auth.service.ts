import * as argon2 from "argon2";

import JWTService from '@/domains/jwt/jwt.service';
import UserService from '@/domains/user/user.service';
import { createUserPayload, signInPayload } from '@/domains/user/user.validator';

import { ConflictError, UnauthorizedError } from '@/shared/error';

export default class AuthService {
    private userService = new UserService();

    registerUser = async (payload: createUserPayload) => {
        const existingUser = await this.userService.fetchUserByPhone(payload.phone, true);
        if (existingUser) throw new ConflictError("A user with the specified phone number already exists.");
        
        const hash = await argon2.hash(payload.password);

        const user = await this.userService.createUser({
            ...payload,
            password: hash
        });

        const tokens = JWTService.generateTokenPair({ id: user.id, phone: user.phone });
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

        const tokens = JWTService.generateTokenPair({ id: user.id, phone: user.phone });
        return { tokens, user: data };
    };

    getSessionData = async (token: string) => {
        const { id } = JWTService.verifyAccessToken(token);
        const user = await this.userService.fetchUserById(id, true);

        return user;
    }
}