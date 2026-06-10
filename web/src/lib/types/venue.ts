import type { PermissionLevel } from "@/generated/prisma/enums";

export type PermissionDomain = "settings" | "schedule" | "bookings" | "analytics" | "payments" | "layout" | "team" | "properties";
export type Permissions = Record<PermissionDomain, PermissionLevel>;

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

export type GroundSize = (typeof GroundSize)[keyof typeof GroundSize];
