import type { components } from "@hagz/api";
import { router } from "expo-router";
import { hourAt, localDateOf } from "./venue";

// Similar venues, from a booking the venue couldn't take: the Search tab set to that booking, around
// the venue, the same sport and size, the same day, hour and length. `at` makes each tap a new
// preset, so Search applies it even when it was already open. Search is a tab, so the stack is
// unwound to the tabs and there's nothing to swipe back to.

type Booking = components["schemas"]["Booking"];

const HOUR = 3_600_000;

export const openSimilarVenues = (booking: Booking, venueName: string) => {
  const { venue, ground } = booking;
  const { timezone } = venue;
  router.dismissTo({
    pathname: "/search",
    params: {
      at: String(Date.now()),
      near: venueName,
      ...(venue.coordinates
        ? {
            latitude: String(venue.coordinates.latitude),
            longitude: String(venue.coordinates.longitude),
          }
        : {}),
      sport: ground.sport,
      ...(ground.sport === "FOOTBALL" && ground.size ? { size: ground.size } : {}),
      date: localDateOf(booking.startsAt, timezone),
      start: `${String(hourAt(booking.startsAt, timezone)).padStart(2, "0")}:00`,
      hours: String(
        Math.max(1, Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / HOUR)),
      ),
    },
  });
};
