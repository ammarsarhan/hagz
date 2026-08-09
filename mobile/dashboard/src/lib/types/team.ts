export interface StaffUser {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string | null;
}

export interface StaffMember {
    userId: string;
    pitchId: string;
    role: "OWNER" | "MANAGER";
    permissions?: Record<string, any> | null;
    user: StaffUser;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}

export interface Invitation {
    id: string;
    pitchId: string;
    name: string;
    phone: string;
    token: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "DELETED";
    expiresAt: string;
    acceptedAt?: string | null;
    rejectedAt?: string | null;
    creatorId: string;
    createdAt: string;
}
