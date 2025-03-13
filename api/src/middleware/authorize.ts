import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";

import { checkIfOwnerExistsAlready, checkIfOwnerVerifiedAlready } from "../repositories/ownerRepository";
import { checkIfUserExistsAlready, checkIfUserVerifiedAlready } from "../repositories/userRepository";
import { validatePitchOwnership } from "../repositories/pitchRepository";
import { checkIfReservationExists, getReservationData } from "../repositories/reservationRepository";
import { TokenPayloadType } from "../utils/token";
import { getPaymentData } from "../repositories/paymentRepository";

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

export async function authorizePitchOwnership(req: Request, res: Response, next: NextFunction) {
    try {
        const { pitch, reservation } = req.params;
        const user = req.user;

        if (!pitch || !user) {
            res.status(400).json({ success: false, message: "Either pitch or owner credentials not provided correctly. Please try again later." });
            return;
        }

        const match = await validatePitchOwnership(pitch, user.id); 

        if (!match) {
            res.status(403).json({ success: false, message: "Either the following resource does not exist or you do not have the permissions to access it. Please provide valid credentials and try again later." });
            return;
        }

        if (reservation) {
            const match = await checkIfReservationExists(reservation, pitch);

            if (!match) {
                res.status(404).json({ success: false, message: "Failed to fetch reservation. Could not find resource." });
                return;
            }
        }
        
        next();
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export async function authorizeReservationOwnership(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.reservation;
        const user = req.user;

        if (!id || !user) {
            res.status(400).json({ success: false, message: "Either reservation or user credentials not provided correctly. Please try again later." });
            return;
        }

        const reservation = await getReservationData(id, ["userId", "ownerId"]);

        if (user.type == "User" && reservation.userId !== user.id) {
            res.status(403).json({ success: false, message: "You are not authorized to access this resource. Please sign in with valid credentials and try again." });
            return;
        }

        if (user.type == "Owner" && reservation.pitch.ownerId !== user.id) {
            res.status(403).json({ success: false, message: "You are not authorized to access this resource. Please sign in with valid credentials and try again." });
            return;
        }
        
        next();
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export async function authorizeReservationValidity(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.reservation;
        const reservation = await getReservationData(id, ["status"]);

        if (reservation.status == "CANCELLED") {
            res.status(403).json({ success: false, message: "This reservation has already been cancelled. To make changes or edit this resource, please contact customer support." });
            return;
        }

        next();
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function authorizePaymentOwnership(req: Request, res: Response, next: NextFunction) {
    try {
        const pitch = req.params.pitch;
        const id = req.params.payment;
        const user = req.user;

        if (!id || !user) {
            throw new Error("Either payment or user credentials provided correctly. Please try again later.");
        }

        const payment = await getPaymentData(id, ["userId", "ownerId", "pitchId"]);

        if (user.type == "User" && payment.reservation.userId !== user.id) {
            res.status(403).json({ success: false, message: "You are not authorized to access this resource. Please sign in with valid credentials and try again." });
            return;
        }

        if (user.type == "Owner" && (payment.reservation.pitch.ownerId !== user.id || payment.reservation.pitchId !== pitch)) {
            res.status(403).json({ success: false, message: "You are not authorized to access this resource. Please sign in with valid credentials and try again." });
            return;
        }

        next();
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export async function authorizePaymentValidity(req: Request, res: Response, next: NextFunction) {
    try {
        const now = new Date();
        const id = req.params.payment;
        
        const payment = await getPaymentData(id, ["status", "expiryDate"]);

        if (payment.status == "EXPIRED" || payment.expiryDate > now) {
            res.status(403).json({ success: false, message: "This payment has already been expired. To make changes or edit this resource, please contact customer support." });
            return;
        }
        
        next();
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}
