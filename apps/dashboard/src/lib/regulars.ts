import type { components } from "@hagz/api";
import { api } from "./api";
import { send } from "./api-errors";

// Regulars (PR 4.5, docs/regulars.md): a customer's standing weekly time at the venue.

export type Regular = components["schemas"]["VenueRegular"];

// The venue's regulars, by weekday and hour, overlapping ones in priority order; ended ones too.
export const regularsQuery = (venueId: string) => ({
  queryKey: ["staff", "venues", venueId, "regulars"],
  queryFn: async () => {
    const result = await send(
      api.GET("/v1/staff/venues/{venueId}/regulars", { params: { path: { venueId } } }),
    );
    if (!result.ok) throw result.error;
    return result.data.data;
  },
  enabled: venueId !== "",
});

// Weeks that were decided one way or another: confirmed, let go, or left to the deadline. Weeks
// released because the regular itself changed aren't in the figures at all.
export const weeksDecided = (regular: Regular) =>
  regular.reliability.confirmed + regular.reliability.released + regular.reliability.missed;

// Whether two regulars want the same hours: the same ground and weekday, hours that meet.
export const overlaps = (a: Regular, b: Regular) =>
  a.ground.id === b.ground.id &&
  a.dayOfWeek === b.dayOfWeek &&
  a.startHour < b.startHour + b.slotCount &&
  b.startHour < a.startHour + a.slotCount;
