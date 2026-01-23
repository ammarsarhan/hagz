import { NextFunction, Request, Response } from 'express';

import AuthService from '@/domains/auth/auth.service';
import UserService from '@/domains/user/user.service';
import { createUserSchema, signInSchema } from '@/domains/user/user.validator';
import { BadRequestError, UnauthorizedError } from '@/shared/error';

export default class AuthController {
    private userService = new UserService();
    private authService = new AuthService();

    signUpUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const payload = { ...req.body, role: "USER" };
            const parsed = createUserSchema.safeParse(payload);
            if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);

            const { user, tokens } = await this.authService.registerUser(parsed.data);
            
            res.cookie("accessToken", tokens.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 15 * 60 * 1000
            });

            res.cookie("refreshToken", tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            return res.status(201).json({ 
                success: true, 
                message: "Created user account successfully.", 
                data: { user }
            });
        } catch (error: any) {
            next(error);
        }
    };

    signUpOwner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const payload = { ...req.body, role: "OWNER" };
            const parsed = createUserSchema.safeParse(payload);
            if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);

            const { user, tokens } = await this.authService.registerUser(parsed.data);
            
            res.cookie("accessToken", tokens.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 15 * 60 * 1000
            });

            res.cookie("refreshToken", tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            return res.status(201).json({ 
                success: true, 
                message: "Created user account successfully.", 
                data: { user }
            });
        } catch (error: any) {
            next(error);
        }
    };

    signIn = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = signInSchema.safeParse(req.body);
            if (!parsed.success) throw new UnauthorizedError(parsed.error.issues[0].message);

            const { user, tokens } = await this.authService.signInUser(parsed.data);

            res.cookie("accessToken", tokens.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 15 * 60 * 1000
            });

            res.cookie("refreshToken", tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            return res.status(200).json({ 
                success: true, 
                message: "Signed user in successfully.", 
                data: { user } 
            });
        } catch (error: any) {
            next(error);
        }
    }; 

    fetchSession = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return res.status(200).json({ 
                    success: true, 
                    message: "An access token was not provided.", 
                    data: { user: null } 
                });
            };

            const id = req.user.id;
            const user = await this.userService.fetchUserById(id, true);

            return res.status(200).json({ 
                success: true, 
                message: "Fetched user session data successfully.", 
                data: { user } 
            });
        } catch (error: any) {
            next(error);
        }
    };
};
