import { Router } from "express";
import authorize from "@/shared/middleware/authorize.middleware";
import UploadController from "@/domains/upload/upload.controller";

const router = Router();

const controller = new UploadController();

router.post('/presign', authorize(true), controller.generatePresign);
router.delete('/presign', authorize(true), controller.deleteUpload);

export default router;

