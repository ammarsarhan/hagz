import type { BookingStatus, PaymentMode } from "@hagz/contracts";
import { AppError } from "@/platform/errors/app-error";

// The booking state machine (docs/architecture.md, "State machines"). Every change is a
// compare-and-set on the status it starts from, written with its BookingEvent.

// How long a PENDING booking waits for staff at most (user, 2026-11-22): the shorter of this and
// the minimum notice before kick-off, so players aren't left hanging and the slots come back in
// time to resell.
export const APPROVAL_HOURS = 12;
// How long a HELD booking waits for payment when the venue hasn't set its own window.
export const DEFAULT_PAYMENT_WINDOW_MINUTES = 15;

export const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ["HELD", "CONFIRMED", "CANCELLED", "EXPIRED", "RESCHEDULED"],
  HELD: ["CONFIRMED", "CANCELLED", "EXPIRED", "RESCHEDULED"],
  UNCONFIRMED: ["CONFIRMED", "RELEASED", "RESCHEDULED"],
  CONFIRMED: ["CANCELLED", "COMPLETED", "NO_SHOW", "RESCHEDULED"],
  CANCELLED: [],
  EXPIRED: [],
  RELEASED: [],
  RESCHEDULED: [],
  // Staff can correct a mistaken mark.
  COMPLETED: ["NO_SHOW"],
  NO_SHOW: ["COMPLETED"],
};

export const canMove = (from: BookingStatus, to: BookingStatus) => TRANSITIONS[from].includes(to);

export const invalidTransition = (from: BookingStatus, to: BookingStatus) =>
  new AppError({
    code: "BOOKING_STATUS_CONFLICT",
    status: 409,
    detail: "This booking has already moved on.",
    extensions: { status: from, attempted: to },
  });

// Statuses whose booking holds its slots (and counts in Booking_no_overlap).
export const LIVE_STATUSES = [
  "PENDING",
  "HELD",
  "UNCONFIRMED",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
] as const satisfies readonly BookingStatus[];

export interface Start {
  status: "PENDING" | "HELD" | "CONFIRMED";
  expiresAt: Date | null;
}

// Where a player's booking starts. Staff approval comes first when the venue asks for it; then
// payment, when any is due online; otherwise it's confirmed at once. Nothing to pay online (a free
// booking) skips payment.
export const startOf = ({
  autoConfirm,
  paymentMode,
  total,
  now,
  startsAt,
  minimumNotice,
  paymentWindow,
}: {
  autoConfirm: boolean;
  paymentMode: PaymentMode;
  total: number;
  now: Date;
  startsAt: Date;
  minimumNotice: number;
  paymentWindow: number | null;
}): Start => {
  if (!autoConfirm) {
    const approvalEnds = now.getTime() + APPROVAL_HOURS * 60 * 60_000;
    const bookingCloses = startsAt.getTime() - minimumNotice * 60_000;
    return { status: "PENDING", expiresAt: new Date(Math.min(approvalEnds, bookingCloses)) };
  }
  if (paymentMode !== "MANUAL" && total > 0) {
    return { status: "HELD", expiresAt: paymentDeadline(now, startsAt, paymentWindow) };
  }
  return { status: "CONFIRMED", expiresAt: null };
};

// When a HELD booking's payment window ends: the venue's window (or the default), never after
// kick-off.
export const paymentDeadline = (now: Date, startsAt: Date, paymentWindow: number | null): Date =>
  new Date(
    Math.min(
      now.getTime() + (paymentWindow ?? DEFAULT_PAYMENT_WINDOW_MINUTES) * 60_000,
      startsAt.getTime(),
    ),
  );
