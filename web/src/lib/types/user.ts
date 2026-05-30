import type { Language, NotificationChannel, PaymentMethod, PermissionLevel, StaffRole, UserStatus } from "@/generated/prisma/enums"

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
        language: Language,
        timezone: string,
        notifications: Array<NotificationChannel>,
        paymentMethod: PaymentMethod
    },
    pitches: Array<{
        pitchId: string,
        role: StaffRole,
        permissions: Permissions
    }>
}