import type { client, InferItem } from "#/lib/client";

export type UserBooking = InferItem<typeof client.app.bookings.$get, 'bookings'>;