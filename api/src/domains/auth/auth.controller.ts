import { NextFunction, Request, Response } from 'express';

import AuthService from './auth.service';

export default class AuthController {
    constructor (private service: AuthService) {}

    signUpUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            return res.status(200).json({
                message: "Hit endpoint successfully.",
                data: null
            });
        } catch (error: any) {
            next(error);
        }
    };
}