import { Request, Response } from "express";
import { handleSendUserVerification, verifyUserByToken, signInUserWithCredentials, signUpUserWithCredentials } from "../services/authService";

export async function signInUser(req: Request, res: Response) {
    try {
        const { email, password } = req.body;
        const tokens = await signInUserWithCredentials(email, password);
        
        res.cookie('refreshToken', tokens.refreshToken, {
            maxAge: 1000 * 60 * 60 * 24 * 7, 
            httpOnly: true, 
            secure: true, 
            sameSite: 'lax',
            signed: true
        });

        res.cookie('accessToken', tokens.accessToken, {
            maxAge: 1000 * 60 * 30,
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        })

        res.status(200).json({ success: true, message: "User signed in successfully."});
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function signUpUser(req: Request, res: Response) {
    try {
        const { name, email, password } = req.body;
        await signUpUserWithCredentials(name, email, password);
        res.status(200).json({ success: true, message: "Created new user account successfully."});
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function sendUserVerificationEmail(req: Request, res: Response) {
    try {
        const { email } = req.body;
        await handleSendUserVerification(email);
        res.status(200).json({ success: true, message: "Verification email sent to specified address successfully." });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function verifyUser(req: Request, res: Response) {
    try {
        const { token } = req.query;

        if (!token) {
            throw new Error("No verification token provided. Unable to verify user.")
        }

        await verifyUserByToken(token as string);
        res.status(200).json({ success: true, message: "Verified user account email address successfully." })
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message })
    }
}