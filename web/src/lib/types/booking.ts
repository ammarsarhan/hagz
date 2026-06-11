import type { client, InferData, InferItem } from "#/lib/client";

export type UserBooking = InferItem<typeof client.app.bookings.$get, 'bookings'>;
export type UserAnalytics = InferData<typeof client.app.bookings.$get>['analytics'];

export type BookingStatus = UserBooking['status'];
