import UserService from '@/domains/user/user.service';
import { createUserPayload } from '@/domains/user/user.validator';

import { ConflictError } from '@/shared/error';

export default class AuthService {
    private userService = new UserService();

    signUpUser = async (payload: createUserPayload) => {
        const existingUser = await this.userService.fetchUserByPhone(payload.phone);
        if (existingUser) throw new ConflictError("A user with the specified phone number already exists.");
        
        const user = await this.userService.createUser(payload);
        return user;
    }
}