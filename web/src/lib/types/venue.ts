import { type PermissionLevel } from "@/generated/prisma/enums";

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

export type GroundSize = (typeof GroundSize)[keyof typeof GroundSize]

export const GroundSurface = {
  NATURAL_GRASS: 'NATURAL_GRASS',
  ARTIFICIAL_TURF: 'ARTIFICIAL_TURF',
  HARD_WOOD: 'HARD_WOOD',
  OTHER: 'OTHER'
} as const

export type GroundSurface = (typeof GroundSurface)[keyof typeof GroundSurface]

export const PriceType = {
  BASE: 'BASE',
  PEAK: 'PEAK',
  DISCOUNT: 'DISCOUNT'
} as const

export type PriceType = (typeof PriceType)[keyof typeof PriceType]

export const BookingStatus = {
  RESERVED: 'RESERVED',
  CONFIRMED: 'CONFIRMED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  NO_SHOW: 'NO_SHOW',
  COMPLETED: 'COMPLETED'
} as const

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus]

export const BookingChannel = {
  ONLINE: 'ONLINE',
  WALK_IN: 'WALK_IN'
} as const

export type BookingChannel = (typeof BookingChannel)[keyof typeof BookingChannel]

export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  WALLET: 'WALLET'
} as const

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const RefundStatus = {
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FORFEITED: 'FORFEITED'
} as const

export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus]

export interface GroundSlot {
  id: string
  startsAt: string
  priceType: PriceType
}
