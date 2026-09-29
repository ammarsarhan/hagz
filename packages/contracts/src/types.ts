export const ROLES = ["customer", "owner", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "rejected",
  "expired",
  "completed",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Bookings in these statuses hold their slot. Must match the exclusion constraint's WHERE clause.
export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const satisfies readonly BookingStatus[];
