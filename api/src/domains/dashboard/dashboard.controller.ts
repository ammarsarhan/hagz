import { Request, Response, NextFunction } from "express";
import DashboardService from "@/domains/dashboard/dashboard.service";
import { requireUser } from "@/shared/lib/authorize";

export default class DashboardController {
    private dashboardService = new DashboardService();

    getState = async (req: Request, res: Response, next: NextFunction) => {
        try {
            requireUser(req);
    
            const id = req.user.id;
            const { permissions } = await this.dashboardService.getDashboard(id);

            return res.status(200).json({ 
                success: true,
                message: "Fetched dashboard state successfully.",
                data: { 
                    permissions 
                }
            })
        } catch (error: any) {
            next(error);
        }
    }
}