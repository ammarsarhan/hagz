export type StaffRole = "OWNER" | "MANAGER";

export interface DashboardStateType {
    permissions: Array<{
        userId: string;
        role: StaffRole;
        pitch: {
            id: string;
            name: string;
        };
    }>
}
