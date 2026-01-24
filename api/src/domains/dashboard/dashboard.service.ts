import PitchService from "@/domains/pitch/pitch.service";
import UserService from "@/domains/user/user.service";
import { authorizeDashboard } from "@/shared/lib/authorize";

export default class DashboardService {
    private userService = new UserService();
    private pitchService = new PitchService();

    getDashboard = async (id: string) => {
        const user = await this.userService.fetchUserById(id);
        authorizeDashboard(user);

        const permissions = await this.pitchService.getAdminPermissions(id);
        return { permissions };
    }
}