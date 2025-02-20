import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import { TokenPayloadType } from "../utils/token";
import { checkIfOwnerVerifiedAlready } from "../repositories/ownerRepository";
import { checkIfUserVerifiedAlready } from "../repositories/userRepository";

export function authorizeUserAccessToken(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
        res.status(401).json({ success: false, message: "Access token not provided. Cannot access this resource." });
    }

    try {
        const decoded = verify(accessToken, process.env.ACCESS_SECRET_KEY || "");

        if (typeof decoded == "object") {
            decoded as TokenPayloadType;

            if (decoded.type !== "User") {
                throw new Error("Access token provided is not for a user account. Cannot access this resource.");
            }

            req.user = {...decoded};
        } else {
            throw new Error("Invalid access token provided.");
        }

        next();
    } catch (error: any) {
        res.status(403).json({ success: false, message: `Could not validate access token. ${error.message}` });
    }
};

export function authorizeOwnerAccessToken(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
        res.status(401).json({ success: false, message: "Access token not provided. Cannot access this resource." });
    }

    try {
        const decoded = verify(accessToken, process.env.ACCESS_SECRET_KEY || "");

        if (typeof decoded == "object") {
            decoded as TokenPayloadType;

            if (decoded.type !== "Owner") {
                throw new Error("Access token provided is not for a owner account. Cannot access this resource.");
            }

            req.user = {...decoded};
        } else {
            throw new Error("Invalid access token provided.");
        }

        next();
    } catch (error: any) {
        res.status(403).json({ success: false, message: `Could not validate access token. ${error.message}` });
    }
};

export async function authorizeVerificationStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.user.id;
        const type = req.user.type;
    
        if (!id || !type) {
            throw new Error("ID or type not provided within the request. Both parameters is required to verify account status.");
        }  

        let isVerified: boolean = false;

        if (type === "User") {
            isVerified = await checkIfUserVerifiedAlready(id);
        } else {
            isVerified = await checkIfOwnerVerifiedAlready(id);
        }
        
        if (!isVerified) {
            throw new Error("Account is not verified. Please verify your account to access this resource.");
        }

        next();
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};
