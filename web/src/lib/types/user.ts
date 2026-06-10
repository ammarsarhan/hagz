import type { StaffRole, UserStatus, UserRole } from "@/generated/prisma/enums"
import type { GroundSize, GroundSport } from "#/lib/types/venue";

export type Language = "EN" | "AR";

export const NotificationChannel = {
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL'
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export default interface User {
    id: string,
    firstName: string,
    lastName: string,
    phone: string,
    email: string | null,
    status: UserStatus,
    isVerified: boolean,
    preferences: {
        role: UserRole,
        language: Language,
        timezone: string,
        notifications: Array<NotificationChannel>,
        area: string | null,
        sports: Array<GroundSport>,
        sizes: Array<GroundSize>
    },
    pitches: Array<{
        pitchId: string,
        role: StaffRole,
        permissions: Permissions
    }>
};
