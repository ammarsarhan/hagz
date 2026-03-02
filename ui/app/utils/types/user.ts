import { StaffRole } from "@/app/utils/types/dashboard";

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED";

export interface User {
    id: string;
    name: string;
    phone: string;
    role: UserRole;
    isOnboarded: boolean;
    isVerified: boolean;
}

export interface PermissionsType {
    userId: string;
    role: StaffRole;
    pitch: {
        id: string;
        name: string;
    };
}
