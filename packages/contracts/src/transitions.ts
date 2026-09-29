import type { BookingStatus, Role } from "./types";

export type BookingActor = Role | "system";

export type BookingTransition = {
  to: BookingStatus;
  by: readonly BookingActor[];
};

// Single source of truth for booking status changes. The server enforces it; apps read it to show valid actions.
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingTransition[]> = {
  pending: [
    { to: "confirmed", by: ["owner", "staff", "system"] },
    { to: "rejected", by: ["owner", "staff"] },
    { to: "cancelled", by: ["customer"] },
    { to: "expired", by: ["system"] },
  ],
  confirmed: [
    { to: "cancelled", by: ["customer", "owner", "staff"] },
    { to: "completed", by: ["system"] },
    { to: "no_show", by: ["owner", "staff"] },
  ],
  cancelled: [],
  rejected: [],
  expired: [],
  completed: [],
  no_show: [],
};

export const canTransition = (from: BookingStatus, to: BookingStatus, actor: BookingActor) =>
  BOOKING_TRANSITIONS[from].some((t) => t.to === to && t.by.includes(actor));

export const isFinalStatus = (status: BookingStatus) => BOOKING_TRANSITIONS[status].length === 0;
