import { Router } from "express";
import DashboardController from '@/domains/dashboard/dashboard.controller';
import authorize from "@/shared/middleware/authorize.middleware";

const router = Router();

const dashboardController = new DashboardController();

router.get('/', authorize(), dashboardController.getState);

export default router;