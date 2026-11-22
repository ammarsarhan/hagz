// BookingEvent.type values. A plain string column, so the list lives here; never rename one, since
// stored history keeps the old name.
export const BOOKING_EVENTS = {
  // Made; data: { status } it started as.
  CREATED: "CREATED",
  // Paid in full or its deposit, or approved with nothing to pay; data: { paymentId? }.
  CONFIRMED: "CONFIRMED",
  // Not approved or paid by expiresAt; data: { from } the status it expired from.
  EXPIRED: "EXPIRED",
} as const;

export type BookingEventType = (typeof BOOKING_EVENTS)[keyof typeof BOOKING_EVENTS];

// The share code, /b/{code}: 8 characters without look-alikes (0/O, 1/I/L), about 10^12 codes, so a
// collision is a retry rather than a risk. `random(n)` returns an integer in [0, n).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 8;

export const bookingCode = (random: (n: number) => number): string =>
  Array.from({ length: CODE_LENGTH }, () => ALPHABET[random(ALPHABET.length)]).join("");
