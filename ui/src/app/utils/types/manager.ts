export type AccessRole = "UNAUTHORIZED" | "VIEW" | "WRITE";

export interface Manager {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
        firstName: string;
        lastName: string;
        email: string;
    },
    acceptedAt: Date;
};

export interface ManagerPermissions {
    bookings: AccessRole;
    payments: AccessRole;
    analytics: AccessRole;
    settings: AccessRole;
    schedule: AccessRole;
    scheduleExceptions: AccessRole;
    manager?: Manager;
    managerId: string;
    pitchId: string;
};