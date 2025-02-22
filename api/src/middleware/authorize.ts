import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import { TokenPayloadType } from "../utils/token";
import { checkIfOwnerExistsAlready, checkIfOwnerVerifiedAlready } from "../repositories/ownerRepository";
import { checkIfUserExistsAlready, checkIfUserVerifiedAlready } from "../repositories/userRepository";

export async function authorizeUserAccessToken(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
        res.status(401).json({ success: false, message: "Access token not provided. Cannot access this resource." });
        return;
    }

    try {
        const decoded = verify(accessToken, process.env.ACCESS_SECRET_KEY || "");

        if (typeof decoded == "object") {
            decoded as TokenPayloadType;

            if (decoded.type !== "User") {
                throw new Error("Access token provided is not for a user account. Cannot access this resource.");
            }

            const exists = await checkIfUserExistsAlready({id: decoded.id});

            if (!exists) {
                res.clearCookie("refreshToken");
                throw new Error("The ID provided with the refresh token does not belong to a user account. Please sign up or sign in to access this resource.");
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

export async function authorizeOwnerAccessToken(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
        res.status(401).json({ success: false, message: "Access token not provided. Cannot access this resource." });
        return;
    }

    try {
        const decoded = verify(accessToken, process.env.ACCESS_SECRET_KEY || "");

        if (typeof decoded == "object") {
            decoded as TokenPayloadType;

            if (decoded.type !== "Owner") {
                throw new Error("Access token provided is not for a owner account. Cannot access this resource.");
            }

            const exists = await checkIfOwnerExistsAlready({ id: decoded.id });

            if (!exists) {
                res.clearCookie("refreshToken");
                throw new Error("The ID provided with the refresh token does not belong to an owner account. Please sign up or sign in to access this resource.");
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

        let isVerified = false;

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
