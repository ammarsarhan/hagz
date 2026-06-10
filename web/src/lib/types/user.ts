import type { NotificationChannel, PermissionLevel, StaffRole, UserStatus, UserRole } from "@/generated/prisma/enums"

export type PermissionDomain = "settings" | "schedule" | "bookings" | "analytics" | "payments" | "layout" | "team" | "properties";
export type Permissions = Record<PermissionDomain, PermissionLevel>;
export type Language = "EN" | "AR";

export const GroundSport = {
  FOOTBALL: 'FOOTBALL',
  BASKETBALL: 'BASKETBALL',
  PADEL: 'PADEL',
  TENNIS: 'TENNIS',
  VOLLEYBALL: 'VOLLEYBALL'
} as const

export type GroundSport = (typeof GroundSport)[keyof typeof GroundSport]


export const GroundSize = {
  FIVE_A_SIDE: 'FIVE_A_SIDE',
  SEVEN_A_SIDE: 'SEVEN_A_SIDE',
  ELEVEN_A_SIDE: 'ELEVEN_A_SIDE',
  STANDARD: 'STANDARD'
} as const

export type GroundSize = (typeof GroundSize)[keyof typeof GroundSize]

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
        location: {
            area: string | null,
            longitude: number | null,
            latitude: number | null
        },
        sports: Array<GroundSport>,
        sizes: Array<GroundSize>
    },
    pitches: Array<{
        pitchId: string,
        role: StaffRole,
        permissions: Permissions
    }>
}