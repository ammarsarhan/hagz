import { NextFunction, Request, Response } from 'express';

import AuthService from './auth.service';

export default class AuthController {
    constructor (private service: AuthService) {}

    signUpUser = async (req: Request, res: Response, next: NextFunction) => {
        try {

        } catch (error: any) {
            next(error);
        }
    };
}