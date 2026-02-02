import { Request, Response, NextFunction } from "express";

import UploadService from "@/domains/upload/upload.service";
import { uploadRequestSchema } from "@/domains/upload/upload.validator";
import { BadRequestError } from "@/shared/lib/error";

export default class UploadController {
    private uploadService = new UploadService();

    generatePresign = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = uploadRequestSchema.safeParse(req.body);
            if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);
            const data = await this.uploadService.getPresignData(parsed.data);

            return res.status(200).json({ 
                success: true,
                message: "Generated presigned URL successfully.",
                data
            });
        } catch (error) {
            next(error);
        }
    }

    deleteUpload = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const key = req.body.key;
            if (!key) throw new BadRequestError("No key was provided.");
            const data = await this.uploadService.deleteObject(key);

            return res.status(200).json({ 
                success: true,
                message: "Deleted upload successfully.",
                data
            });
        } catch (error) {
            next (error);
        }
    }
}