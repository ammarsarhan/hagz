import { api } from "./api";
import { send } from "./api-errors";

// Bookings waiting for the venue's answer, the soonest deadline first: the Calendar's inbox count
// and the Booking requests screen read the same query, so answering one updates both. Players book
// from elsewhere, so it's read again every minute while either is open.
export const REQUESTS_REFRESH = 60_000;

export const bookingRequests = (venueId: string, enabled = true) => ({
  queryKey: ["staff", "venues", venueId, "bookings", "pending"],
  queryFn: async () => {
    const result = await send(
      api.GET("/v1/staff/venues/{venueId}/bookings/pending", { params: { path: { venueId } } }),
    );
    if (!result.ok) throw result.error;
    return result.data.data;
  },
  enabled: enabled && venueId !== "",
  refetchInterval: REQUESTS_REFRESH,
});
