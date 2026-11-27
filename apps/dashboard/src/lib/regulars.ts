import type { TFunction } from "i18next";
import type { components } from "@hagz/api";
import { api } from "./api";
import { send } from "./api-errors";
import { intlLocale } from "./language";

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

// One regular, with its reservations still to come and the weeks it couldn't reserve.
export const regularQuery = (venueId: string, regularId: string) => ({
  queryKey: ["staff", "venues", venueId, "regulars", regularId],
  queryFn: async () => {
    const result = await send(
      api.GET("/v1/staff/venues/{venueId}/regulars/{regularId}", {
        params: { path: { venueId, regularId } },
      }),
    );
    if (!result.ok) throw result.error;
    return result.data;
  },
  enabled: venueId !== "" && regularId !== "",
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

// "1, 8, 15 and 22 Dec"; "29 Dec, 5, 12 and 19 Jan" across a month's end. Joined by hand: Hermes
// has no Intl.ListFormat.
// "a, b and c", in the app's words (Hermes has no Intl.ListFormat).
export const datesJoin = (t: TFunction, parts: readonly string[]) => {
  const last = parts.at(-1) ?? "";
  return parts.length < 2
    ? last
    : t("screens.regulars.new.and", {
        list: parts.slice(0, -1).join(t("screens.regulars.new.comma")),
        last,
      });
};

export const datesLabel = (t: TFunction, dates: readonly string[]) => {
  const month = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", month: "short" });
  const parts = dates.map((date, index) => {
    const at = new Date(`${date}T12:00:00Z`);
    const next = dates[index + 1];
    const lastOfMonth = !next || next.slice(0, 7) !== date.slice(0, 7);
    return lastOfMonth ? `${at.getUTCDate()} ${month.format(at)}` : String(at.getUTCDate());
  });
  return datesJoin(t, parts);
};
