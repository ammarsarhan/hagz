import { api } from "./api";
import { send } from "./api-errors";

// How the venue runs its bookings day to day (staff holds, regulars): the hold's length shows on
// the Calendar's + and on Hold a time.
export const bookingSettingsQuery = (venueId: string) => ({
  queryKey: ["staff", "venues", venueId, "booking-settings"],
  queryFn: async () => {
    const result = await send(
      api.GET("/v1/staff/venues/{venueId}/booking-settings", {
        params: { path: { venueId } },
      }),
    );
    if (!result.ok) throw result.error;
    return result.data;
  },
  enabled: venueId !== "",
  staleTime: 5 * 60_000,
});
