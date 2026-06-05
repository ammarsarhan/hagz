import type { GroundSize, GroundSport, Language, NotificationChannel, PermissionLevel, StaffRole, UserRole, UserStatus } from "@/generated/prisma/enums"

export type PermissionDomain = "settings" | "schedule" | "bookings" | "analytics" | "payments" | "layout" | "team" | "properties";
export type Permissions = Record<PermissionDomain, PermissionLevel>;

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