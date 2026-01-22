import { NextFunction, Request, Response } from 'express';

import AuthService from '@/domains/auth/auth.service';
import { createUserSchema, signInSchema } from '../user/user.validator';
import { BadRequestError, UnauthorizedError } from '@/shared/error';

export default class AuthController {
    private authService = new AuthService();

    signUpUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = createUserSchema.safeParse(req.body);
            if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);

            const { user, tokens } = await this.authService.registerUser(parsed.data);
            
            res.cookie("accessToken", tokens.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.cookie("refreshToken", tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 15 * 60 * 1000
            });

            return res.status(200).json({ 
                success: true, 
                message: "Created user account successfully.", 
                data: user 
            });
        } catch (error: any) {
            next(error);
        }
    };

    signIn = async (req: Request, res: Response, next: NextFunction) => {
        try {
            console.log("Hit")

            const parsed = signInSchema.safeParse(req.body);
            if (!parsed.success) throw new UnauthorizedError(parsed.error.issues[0].message);

            const { user, tokens } = await this.authService.signIn(parsed.data);

            res.cookie("accessToken", tokens.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.cookie("refreshToken", tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 15 * 60 * 1000
            });

            return res.status(200).json({ 
                success: true, 
                message: "Signed user in successfully.", 
                data: user 
            });
        } catch (error: any) {
            next(error);
        }
    }; 
};
