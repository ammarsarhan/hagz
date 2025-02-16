import { Router, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { generateAccessToken, TokenPayloadType } from "../utils/token";

const refresh = Router();

refresh.post('/user', (req: Request, res: Response) => {
    const refreshToken = req.signedCookies.refreshToken;

    if (!refreshToken) {
        res.status(400).json({success: false, message: "No refresh token provided. Unable to create new access token."});
    }

    try {
        const decoded = verify(refreshToken, process.env.REFRESH_SECRET_KEY || "");

        if (typeof decoded == "object") {
            decoded as TokenPayloadType;

            if (decoded.type !== "User") {
                throw new Error("Invalid token type. Please sign in again as a user.");
            }

            const accessToken = generateAccessToken({id: decoded.id, type: "User"});
    
            res.cookie("accessToken", accessToken, {
                maxAge: 1000 * 60 * 30,
                httpOnly: true,
                secure: true,
                sameSite: 'lax'
            });
        
            res.status(200).json({success: true, message: "Access token created successfully."});
        } else {
            res.status(406).json({success: false, message: `Invalid refresh token. Please sign in again.`});
        }
    } catch (error: any) {
        res.status(400).json({success: false, message: `Could not verify refresh token. ${error.message}`});
    }
});

refresh.post('/owner', (req: Request, res: Response) => {
    const refreshToken = req.signedCookies.refreshToken;

    if (!refreshToken) {
        res.status(400).json({success: false, message: "No refresh token provided. Unable to create new access token."});
    }

    try {
        const decoded = verify(refreshToken, process.env.REFRESH_SECRET_KEY || "");

        if (typeof decoded == "object") {
            decoded as TokenPayloadType;

            if (decoded.type !== "Owner") {
                throw new Error("Invalid token type. Please sign in again as an owner.");
            }

            const accessToken = generateAccessToken({id: decoded.id, type: "Owner"});
    
            res.cookie("accessToken", accessToken, {
                maxAge: 1000 * 60 * 30,
                httpOnly: true,
                secure: true,
                sameSite: 'lax'
            });
        
            res.status(200).json({success: true, message: "Access token created successfully."});
        } else {
            res.status(406).json({success: false, message: `Invalid refresh token. Please sign in again.`});
        }
    } catch (error: any) {
        res.status(400).json({success: false, message: `Could not verify refresh token. ${error.message}`});
    }
});


export default refresh;