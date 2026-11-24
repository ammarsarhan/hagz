import type { components } from "@hagz/api";
import type { PublicVenue } from "./venue";

// The booking Review just made, and its venue, handed to the screen after it (app/booked/[id].tsx)
// so it shows at once instead of loading what's already here. Anything else opening that screen
// (a notification, later) finds nothing and reads it from the API.

export type Booking = components["schemas"]["Booking"];

let last: { booking: Booking; venue: PublicVenue } | null = null;

export const rememberBooking = (booking: Booking, venue: PublicVenue) => {
  last = { booking, venue };
};

export const justBooked = (id: string) => (last?.booking.id === id ? last : null);
