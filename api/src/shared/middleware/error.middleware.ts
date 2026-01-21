import { Request, Response, NextFunction } from "express";
import AppError from "@/shared/error";

export default function handleError(
    err: Error,
    _: Request,
    res: Response
) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            data: null
        });
    };

    return res.status(500).json({
        success: false,
        message: "An internal server error has occurred.",
        data: null
    });
}
