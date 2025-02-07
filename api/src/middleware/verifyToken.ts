import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";

export default function verifyToken (req: Request, res: Response, next: NextFunction) {
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Unauthorized. No access token provided." });

    try {
        const key = process.env.JWT_SECRET_KEY || "";
        const decoded = verify(token, key);
        next();
    } catch (error) {
        return res.status(403).json({ message: "Forbidden. Could not decode access token." });
    }
}