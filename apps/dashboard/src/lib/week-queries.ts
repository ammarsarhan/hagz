import { api } from "./api";
import { send } from "./api-errors";

// A week of a venue's calendar, from its Sunday: the bookings that hold slots, and the slots. Read
// by the Calendar and by Move, under the same keys, so each finds the other's answer there.

// Others book and cancel meanwhile: read again every minute while on screen.
export const WEEK_REFRESH = 60_000;

const fetched = async <T>(request: Promise<{ data?: T; error?: unknown }>): Promise<T> => {
  const result = await send(request);
  if (!result.ok) throw result.error;
  return result.data;
};

export const calendarKey = (venueId: string, ...rest: string[]) => [
  "staff",
  "venues",
  venueId,
  ...rest,
];

export const weekBookings = (venueId: string, start: string, enabled: boolean) => ({
  queryKey: calendarKey(venueId, "bookings", start),
  queryFn: async () =>
    (
      await fetched(
        api.GET("/v1/staff/venues/{venueId}/bookings", {
          params: { path: { venueId }, query: { date: start, span: 7 } },
        }),
      )
    ).data,
  enabled,
  refetchInterval: WEEK_REFRESH,
});

export const weekSlots = (venueId: string, start: string, enabled: boolean) => ({
  queryKey: calendarKey(venueId, "slots", start),
  queryFn: () =>
    fetched(
      api.GET("/v1/staff/venues/{venueId}/slots", {
        params: { path: { venueId }, query: { date: start, span: 7 } },
      }),
    ),
  enabled,
  refetchInterval: WEEK_REFRESH,
});
