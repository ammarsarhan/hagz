import { Request, Response } from "express";
import { signInUserWithCredentials, signUpUserWithCredentials } from "../services/authService";

export async function signInUser(req: Request, res: Response) {
    try {
        const { email, password } = req.body;
        const tokens = await signInUserWithCredentials(email, password);
        
        res.cookie('refreshToken', tokens.refreshToken, {
            maxAge: 1000 * 60 * 60 * 24 * 7, 
            httpOnly: true, 
            secure: true, 
            sameSite: 'none',
            signed: true
        });

        res.status(200).json({message: tokens.accessToken});
    } catch (error: any) {
        res.status(400).json({message: error.message});
    }
}

export async function signUpUser(req: Request, res: Response) {
    try {
        const { name, email, password } = req.body;
        await signUpUserWithCredentials(name, email, password);
        res.status(200).json({message: "Successfully created new user account!"});
    } catch (error: any) {
        res.status(400).json({message: error.message});
    }
}