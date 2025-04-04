import { Request, Response } from "express";
import { handleSendUserVerification, verifyUserByToken, signInUserWithCredentials, signUpUserWithCredentials, signUpOwnerWithCredentials, handleSendOwnerVerification, verifyOwnerByToken, signInOwnerWithCredentials } from "../services/authService";
import { maskEmail, maskPhone } from "../utils/mask";
import { verify } from "jsonwebtoken";
import { generateAccessToken, TokenPayloadType } from "../utils/token";
import { fetchUserById } from "../repositories/userRepository";
import { fetchOwnerById } from "../repositories/ownerRepository";

export async function signInUser(req: Request, res: Response) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new Error('Insufficient parameters provided to sign in user.'); 
        }

        const data = await signInUserWithCredentials(email, password);
        
        res.cookie('refreshToken', data.refreshToken, {
            maxAge: 1000 * 60 * 60 * 24 * 7, 
            httpOnly: true, 
            secure: true, 
            sameSite: 'none',
            signed: true
        });

        res.cookie('accessToken', data.accessToken, {
            maxAge: 1000 * 60 * 30,
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        })

        res.status(200).json({ success: true, message: "User signed in successfully.", 
            data: {
                id: data.user.id,
                name: data.user.name,
                email: maskEmail(data.user.email),
                phone: maskPhone(data.user.phone),
                status: data.user.accountStatus
            }
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function signUpUser(req: Request, res: Response) {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !phone || !password) {
            throw new Error('Insufficient parameters provided to create user.'); 
        }

        await signUpUserWithCredentials(name, email, phone, password);
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

export async function signInOwner(req: Request, res: Response) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new Error('Insufficient parameters provided to sign in owner.'); 
        }

        const data = await signInOwnerWithCredentials(email, password);
        
        res.cookie('refreshToken', data.refreshToken, {
            maxAge: 1000 * 60 * 60 * 24 * 7, 
            httpOnly: true, 
            secure: true, 
            sameSite: 'lax',
            signed: true
        });

        res.cookie('accessToken', data.accessToken, {
            maxAge: 1000 * 60 * 30,
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        })

        res.status(200).json({ success: true, message: "Owner signed in successfully.", data: {
            id: data.owner.id,
            name: data.owner.name,
            email: maskEmail(data.owner.email),
            phone: maskPhone(data.owner.phone),
            status: data.owner.accountStatus
        }});
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function signUpOwner(req: Request, res: Response) {
    try {
        const { name, company, email, phone, secondaryPhone, password, location } = req.body;

        if (!name || !email || !phone || !secondaryPhone || !password || !location) {
            throw new Error('Insufficient parameters provided to create owner.'); 
        }

        await signUpOwnerWithCredentials(name, company, email, phone, secondaryPhone, password, location);
        res.status(200).json({ success: true, message: "Created new owner account successfully."});
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function sendOwnerVerificationEmail(req: Request, res: Response) {
    try {
        const { email } = req.body;
        await handleSendOwnerVerification(email);
        res.status(200).json({ success: true, message: "Verification email sent to specified address successfully." });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function verifyOwner(req: Request, res: Response) {
    try {
        const { token } = req.query;

        if (!token) {
            throw new Error("No verification token provided. Unable to verify owner.")
        }

        await verifyOwnerByToken(token as string);
        res.status(200).json({ success: true, message: "Verified owner account email address successfully." })
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message })
    }
}

export async function fetchSessionData(req: Request, res: Response) {
    try {
        const refreshToken = req.signedCookies.refreshToken;

        if (!refreshToken) {
            res.status(400).json({
                success: false,
                message: "No refresh token provided. Unable to create a new access token."
            });
            return;
        }

        const decoded = verify(refreshToken, process.env.REFRESH_SECRET_KEY || "") as TokenPayloadType;

        if (typeof decoded !== "object" || !decoded.id || !decoded.type) {
            res.status(406).json({
                success: false,
                message: "Invalid refresh token. Please sign in again."
            });
            return;
        }

        const accessToken = generateAccessToken({ id: decoded.id, type: decoded.type });

        res.cookie("accessToken", accessToken, {
            maxAge: 1000 * 60 * 30,
            httpOnly: true,
            secure: true,
            sameSite: "lax"
        });

        let user = null;
        let owner = null;

        if (decoded.type === "User") {
            user = await fetchUserById(decoded.id);
            user = {
                id: user.id,
                name: user.name,
                email: maskEmail(user.email),
                phone: maskPhone(user.phone),
                status: user.accountStatus
            };
        } else if (decoded.type === "Owner") {
            owner = await fetchOwnerById(decoded.id);
            owner = {
                id: owner.id,
                name: owner.name,
                company: owner.company,
                email: maskEmail(owner.email),
                phone: maskPhone(owner.phone),
                status: owner.accountStatus,
                pitches: owner.pitches.map(pitch => {
                    return {
                        id: pitch.id,
                        name: pitch.name,
                        grounds: pitch._count.grounds
                    }
                })
            };
        }

        res.status(200).json({
            success: true,
            message: "Fetched session data successfully.",
            data: { user, owner }
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

export async function signOut(req: Request, res: Response) {
    try {
        res.clearCookie('refreshToken');
        res.clearCookie('accessToken');

        res.status(200).json({ success: true, message: "Signed out in-use account successfully."});
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}