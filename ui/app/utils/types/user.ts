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
