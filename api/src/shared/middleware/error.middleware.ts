import { Request, Response, NextFunction } from "express";
import AppError from "@/shared/lib/error";

export default function sendError(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    console.log(err);

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            data: null
        });
    }

    return res.status(500).json({
        success: false,
        message: "An internal server error has occurred.",
        data: null
    });
}