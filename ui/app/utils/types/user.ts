import { StaffRole } from "@/app/utils/types/dashboard";

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "UNVERIFIED" | "ACTIVE" | "SUSPENDED";

export interface User {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
}

export interface PermissionsType {
    userId: string;
    role: StaffRole;
    pitch: {
        id: string;
        nameEn: string;
        nameAr: string;
    };
}
