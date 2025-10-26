import { resolveUserRole } from "@/utils/dashboard";
import prisma from "@/utils/prisma";
import { AccessTokenPayload, generateAccessToken } from "@/utils/token";
import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export async function authorize(req: Request, res: Response, next: NextFunction) {
  try {
    // Expecting a cookies object with an accessToken provided.
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Missing or invalid cookie, please provide a valid token." });
    }
    
    // Attempt to refresh the token silently on the backend instead of directly calling the refresh route.
    if (!accessToken) {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as JwtPayload;
      const id = decoded.sub;
      
      if (!id) {
        return res.status(401).json({ message: "Invalid refreshToken provided. Token failed verification process. Please sign in and try again." });
      };

      const user = await prisma.user.findUnique({ 
          where: { 
            id,
            status: { notIn: ["DELETED", "SUSPENDED"] }
          }, 
          select: { 
              id: true,
              status: true
          }
      });

      const role = await resolveUserRole(id);

      if (!user) {
          return res.status(404).json({ message: "Could not find user with the specified ID. Failed to fetch user data."})
      };

      // Generate a fresh access token and append it to the cookies as an http-only cookie.
      const accessToken = await generateAccessToken(user.id, randomUUID(), role, user.status);
  
      res.cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 15 * 60 * 1000 // 15 minutes
      });
      
      // Attach user payload data to request.
      req.user = {
        sub: user.id, 
        jti: randomUUID(), 
        role: role, 
        status: user.status 
      };

      return next();
    };

    // Verify the token with the secret key.
    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET!) as AccessTokenPayload;

    if (!decoded.jti) {
      return res.status(401).json({ error: "An invalid token has been provided. Please sign in again." });
    };

    // Attach user payload data to request.
    req.user = decoded;
    
    next();
  } catch (err) {
    return res.status(500).json({ message: err });
  }
};

export async function optionalAuthorize(req: Request, res: Response, next: NextFunction) {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    // If no token at all, just continue without a user
    if (!accessToken && !refreshToken) return next();
    await authorize(req, res, next);
  } catch {
    // If token invalid, skip setting req.user
    next();
  }
};
