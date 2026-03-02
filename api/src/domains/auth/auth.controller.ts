import { NextFunction, Request, Response } from 'express';

import AuthService from '@/domains/auth/auth.service';
import UserService from '@/domains/user/user.service';
import { createUserSchema, signInSchema } from '@/domains/user/user.validator';
import { BadRequestError, UnauthorizedError } from '@/shared/lib/error';

export default class AuthController {
    private userService = new UserService();
    private authService = new AuthService();

    signUpUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const payload = { ...req.body, role: "USER" };
            const parsed = createUserSchema.safeParse(payload);
            if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);

            const meta = { 
                ipAddress: req.ip, 
                userAgent: req.headers["user-agent"] 
            };

            const { tokens } = await this.authService.registerUser(parsed.data, meta);
            
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
                data: null
            });
        } catch (error: any) {
            next(error);
        }
    };

    signUpOwner = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const payload = { ...req.body, role: "ADMIN" };
            const parsed = createUserSchema.safeParse(payload);
            if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);

            const meta = {
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            };

            const { tokens } = await this.authService.registerUser(parsed.data, meta);
            
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
                message: "Created owner account successfully.", 
                data: null
            });
        } catch (error: any) {
            next(error);
        }
    };

    signIn = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = signInSchema.safeParse(req.body);
            if (!parsed.success) throw new UnauthorizedError(parsed.error.issues[0].message);

            const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
            const { user, permissions, tokens } = await this.authService.signInUser(parsed.data, meta);

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
                data: { user, permissions } 
            });
        } catch (error: any) {
            next(error);
        }
    }; 

    signOut = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (refreshToken) await this.authService.signOutUser(refreshToken);

            res.clearCookie("accessToken");
            res.clearCookie("refreshToken");

            return res.status(200).json({
                success: true, 
                message: "Signed out user successfully.", 
                data: null
            });
        } catch (error: any) {
            next(error);
        }
    }

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
    
    refreshSession = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) throw new BadRequestError("A refresh token was not provided. Please sign in and try again.");

            const tokens = await this.authService.refreshSessionToken(refreshToken);

            res.cookie("refreshToken", tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.cookie("accessToken", tokens.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 15 * 60 * 1000
            });

            return res.status(200).json({ 
                success: true, 
                message: "Refreshed user access token successfully.",
                data: null
            });
        } catch (error: any) {
            next(error);
        }
    };
};
