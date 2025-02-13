import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import { TokenPayloadType } from "../utils/token";

export function authorizeUserAccessToken(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
        res.status(401).json({ success: false, message: "Access token not provided. Cannot access this resource." });
    }

    try {
        const decoded = verify(accessToken, process.env.ACCESS_SECRET_KEY || "");

        if (typeof decoded == "object") {
            decoded as TokenPayloadType;
            req.user = {...decoded};
        } else {
            throw new Error("Invalid access token provided.");
        }

        next();
    } catch (error: any) {
        res.status(403).json({ success: false, message: `Could not validate acceess token. ${error.message}` });
    }

}