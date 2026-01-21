import { NextFunction, Request, Response } from 'express';

import AuthService from '@/domains/auth/auth.service';
import { createUserSchema } from '../user/user.validator';
import { BadRequestError } from '@/shared/error';

export default class AuthController {
    private authService = new AuthService();

    signUpUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = createUserSchema.safeParse(req.body);
            if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);

            const user = await this.authService.signUpUser(parsed.data);
            return res.status(200).json({ message: "Created user account successfully.", data: user });
        } catch (error: any) {
            next(error);
        }
    };
};
