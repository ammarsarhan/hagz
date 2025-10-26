export type InvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export interface Invitation {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    message: string | null;
    status: InvitationStatus;
    token: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    pitchId: string;
    requiresAuth: boolean;
    requiresUser: boolean;
    createdAt: Date;
    updatedAt: Date;
    issuer: {
        user: {
            firstName: string
            lastName: string
        }
    };
    pitch: {
        name: string
    }
}