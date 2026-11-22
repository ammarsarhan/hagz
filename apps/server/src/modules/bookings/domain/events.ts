// BookingEvent.type values. A plain string column, so the list lives here; never rename one, since
// stored history keeps the old name.
export const BOOKING_EVENTS = {
  // Made; data: { status } it started as.
  CREATED: "CREATED",
  // Paid in full or its deposit, or approved with nothing to pay; data: { paymentId? }.
  CONFIRMED: "CONFIRMED",
  // Not approved or paid by expiresAt; data: { from } the status it expired from.
  EXPIRED: "EXPIRED",
  // Staff approved a PENDING booking; data: { to } HELD (payment due) or CONFIRMED.
  APPROVED: "APPROVED",
  // Staff declined a PENDING booking (with its VENUE Cancellation); data: { reason? }.
  DECLINED: "DECLINED",
  // Staff marked how it went, or corrected the mark; data: { from }.
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
  // A staff hold given more time; data: { expiresAt } the new deadline.
  HOLD_EXTENDED: "HOLD_EXTENDED",
  // A staff hold let go before it ran out (EXPIRED); data: { bookingId? } the move that took its
  // slots, if one did.
  HOLD_RELEASED: "HOLD_RELEASED",
  // Moved or swapped (now RESCHEDULED); data: { to, type, groupId? }. The new booking's CREATED
  // carries { status, from, type }.
  RESCHEDULED: "RESCHEDULED",
  // The player kept a move staff made, or rejected it (cancelled as the venue's, refunded in full).
  MOVE_ACCEPTED: "MOVE_ACCEPTED",
  MOVE_REJECTED: "MOVE_REJECTED",
} as const;

export type BookingEventType = (typeof BOOKING_EVENTS)[keyof typeof BOOKING_EVENTS];

// The share code, /b/{code}: 8 characters without look-alikes (0/O, 1/I/L), about 10^12 codes, so a
// collision is a retry rather than a risk. `random(n)` returns an integer in [0, n).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 8;

export const bookingCode = (random: (n: number) => number): string =>
  Array.from({ length: CODE_LENGTH }, () => ALPHABET[random(ALPHABET.length)]).join("");
